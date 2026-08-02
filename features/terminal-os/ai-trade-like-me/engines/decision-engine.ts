/**
 * Decision Engine V2 — inspectable sub-scores + computeConfidence.
 * Cosine similarity for behaviorMatch. LLM never generates confidence.
 */

import type {
  DisagreementCheck,
  ExplainableDecision,
  MarketContext,
  OpportunityScore,
  ScoreCitation,
  TlmDecisionAction,
  TraderDna,
  UserWeightPrefs,
} from '../types'
import { DEFAULT_WEIGHT_PREFS } from '../types'
import { computeConfidence, computeMarketConfidence, cosineSimilarity } from '../lib/scoring'
import { predictOpportunity } from './prediction-engine'
import type { TlmEventBus } from './event-bus'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function dnaConditionVector(dna: TraderDna | null): Record<string, number> {
  if (!dna) return {}
  const v: Record<string, number> = {}
  for (const c of dna.entryConditionProfile) {
    if (c.field === 'whaleActivityScore') v.whaleActivityScore = c.value
    if (c.field === 'volumeToLiquidityRatio') v.volumeToLiquidityRatio = clamp(c.value * 10, 0, 100)
  }
  v.tokenScore = 50 + dna.winRatePct * 0.3
  v.riskScore = 100 - dna.riskAppetite
  v.liquidityRising = dna.styleVector.liquidityHunter * 100
  v.socialMomentum = dna.styleVector.narrativeTrader * 80 + 20
  v.volatility24h = dna.styleVector.scalper * 40 + dna.styleVector.momentum * 30
  return v
}

function marketQuality(intel: MarketContext): number {
  return clamp(
    intel.tokenScore * 0.35 +
      intel.smartMoneyScore * 0.25 +
      intel.volumeScore * 0.2 +
      (intel.liquidityTrend === 'increasing' ? 15 : intel.liquidityTrend === 'decreasing' ? -10 : 5) +
      (intel.securityBand === 'danger' ? -25 : intel.securityBand === 'caution' ? -8 : 8),
    5,
    98,
  )
}

function inferUserWouldTypically(dna: TraderDna | null, intel: MarketContext): TlmDecisionAction {
  if (!dna) return 'DO_NOTHING'
  const bm = cosineSimilarity(dnaConditionVector(dna), intel.conditionVector)
  if (dna.styleVector.whaleFollower > 0.2 && intel.whaleBias === 'accumulating') return 'BUY'
  if (dna.styleVector.momentum > 0.25 && intel.orderFlowBias === 'buy' && bm >= 50) return 'BUY'
  if (intel.whaleBias === 'distributing' && dna.styleVector.whaleFollower > 0.15) return 'BUY' // habit FOMO
  if (bm >= 60 && intel.orderFlowBias !== 'sell') return 'BUY'
  return 'DO_NOTHING'
}

export function buildDisagreement(
  userWould: TlmDecisionAction,
  aiAction: TlmDecisionAction,
  intel: MarketContext,
  teachRules: string[] = [],
): DisagreementCheck | null {
  if (userWould === aiAction) return null
  if (userWould === 'DO_NOTHING' && aiAction === 'WAIT') return null

  const deviations: string[] = []
  if (intel.whaleBias === 'distributing') {
    deviations.push('MarketContext.whaleBias=distributing')
  }
  if (intel.liquidityTrend === 'decreasing') {
    deviations.push('MarketContext.liquidityTrend=decreasing')
  }
  if (intel.securityBand === 'danger' || intel.securityBand === 'caution') {
    deviations.push(`MarketContext.securityBand=${intel.securityBand}`)
  }

  if (!deviations.length && userWould === aiAction) return null

  const overrideReason =
    userWould === 'BUY' && aiAction === 'WAIT'
      ? `Normally you would BUY here, however live market context shows ${deviations.join(', ') || 'elevated risk'} — AI recommends WAIT.`
      : userWould === 'SELL' && aiAction === 'WAIT'
        ? `Normally you might SELL now, however prediction upside remains — AI recommends HOLD/WAIT.`
        : `AI overrides typical ${userWould} → ${aiAction} citing ${deviations.join(', ') || 'risk engine'}.`

  const requiresAck =
    teachRules.length > 0 &&
    teachRules.some((r) => r.toLowerCase().includes('never') || r.toLowerCase().includes('always'))

  return {
    userWouldTypically: userWould,
    aiRecommends: aiAction,
    overrideReason,
    overrideConfidence: clamp(70 + deviations.length * 8, 60, 95),
    requiresExplicitUserAck: requiresAck,
    marketDeviationCited: deviations,
  }
}

export function decide(
  dna: TraderDna | null,
  intel: MarketContext,
  opts?: {
    hasOpenPosition?: boolean
    weightPrefs?: UserWeightPrefs
    teachRules?: string[]
    collectiveBoostPct?: number
    unavailableEngines?: string[]
  },
): ExplainableDecision {
  const prefs = opts?.weightPrefs ?? DEFAULT_WEIGHT_PREFS
  const unavailable = [...(opts?.unavailableEngines ?? [])]
  if (!dna && !unavailable.includes('trader-dna')) unavailable.push('trader-dna')
  const pred = predictOpportunity(dna, intel)
  const citations: ScoreCitation[] = []
  const hasDna = Boolean(dna)

  const behaviorMatch = hasDna
    ? cosineSimilarity(dnaConditionVector(dna), intel.conditionVector)
    : 0
  if (hasDna) {
    citations.push({
      source: 'TraderDNA',
      field: 'entryConditionProfile',
      value: behaviorMatch,
      contribution: `cosine similarity ${behaviorMatch}% vs entry profile`,
    })
  } else {
    citations.push({
      source: 'TraderDNA',
      field: 'entryConditionProfile',
      value: 'n/a',
      contribution: 'TraderDNA unavailable — behaviorMatch excluded from confidence (not penalized)',
    })
  }

  const mq = marketQuality(intel)
  citations.push({
    source: 'MarketContext',
    field: 'tokenScore+smartMoney+volume',
    value: Math.round(mq),
    contribution: 'market quality composite',
  })

  const risk = intel.riskScore
  const executionQuality = clamp(
    70 - (intel.volatilityPct > 20 ? 15 : 0) + (intel.liquidityTrend === 'increasing' ? 10 : 0),
    20,
    95,
  )

  let probability = pred.probability
  if (opts?.collectiveBoostPct != null) {
    probability = clamp(probability + opts.collectiveBoostPct * 0.3, 18, 92)
    citations.push({
      source: 'Collective',
      field: 'similarDnaAvgOutcome',
      value: opts.collectiveBoostPct,
      contribution: 'anonymized peer cluster boost (opt-in)',
    })
  }

  // Market confidence never uses behaviorMatch
  let marketConfidence = computeMarketConfidence(
    {
      marketQuality: mq,
      probability,
      timing: pred.timing,
      executionQuality,
      risk,
    },
    prefs,
  )
  // Soft penalty only for missing *market* engines (not trader-dna / portfolio)
  const marketMissing = unavailable.filter(
    (e) => e !== 'trader-dna' && e !== 'portfolio-intelligence',
  )
  if (marketMissing.length) {
    const penalty = Math.min(20, marketMissing.length * 6)
    marketConfidence = clamp(marketConfidence - penalty, 5, 95)
    citations.push({
      source: 'MarketContext',
      field: 'degradedInputs',
      value: marketMissing.length,
      contribution: `degraded market inputs: ${marketMissing.join(', ')} (−${penalty} market conf)`,
    })
  }

  let personalizedConfidence: number | undefined
  if (hasDna) {
    personalizedConfidence = computeConfidence(
      {
        behaviorMatch,
        marketQuality: mq,
        probability,
        timing: pred.timing,
        executionQuality,
        risk,
      },
      prefs,
    )
  }

  const confidenceMode = hasDna ? 'personalized' : 'market'
  const confidence = hasDna ? (personalizedConfidence as number) : marketConfidence

  citations.push({
    source: 'Weights',
    field: hasDna ? 'computeConfidence' : 'computeMarketConfidence',
    value: confidence,
    contribution: hasDna
      ? `personalized prefs bm=${prefs.behaviorMatch} mq=${prefs.marketQuality}`
      : `market-only conf (behaviorMatch excluded) mq=${prefs.marketQuality}`,
  })

  const opportunity: OpportunityScore = {
    behaviorMatch: Math.round(behaviorMatch),
    marketQuality: Math.round(mq),
    risk: Math.round(risk),
    probability,
    expectedRoiPct: pred.expectedRoiPct,
    expectedDrawdownPct: pred.expectedDrawdownPct,
    timing: pred.timing,
    executionQuality: Math.round(executionQuality),
    confidence,
    action: 'DO_NOTHING',
    citations,
  }

  const userWould = inferUserWouldTypically(dna, intel)
  const reasons: string[] = []
  let action: TlmDecisionAction = 'DO_NOTHING'
  let improvesTrader = false
  let disagreement: DisagreementCheck | null = null

  if (unavailable.length) {
    reasons.push(
      `Inputs noted: ${unavailable.join(', ')} — ${
        hasDna ? 'personalized' : 'market'
      } confidence mode.`,
    )
  }

  if (intel.securityBand === 'danger' || risk >= 78) {
    action = opts?.hasOpenPosition ? 'EXIT' : 'DO_NOTHING'
    reasons.push(
      `Security band ${intel.securityBand} · riskScore ${risk} — capital protection first (MarketContext.riskScore).`,
    )
    improvesTrader = true
  } else if (hasDna && intel.whaleBias === 'distributing' && userWould === 'BUY') {
    action = 'WAIT'
    improvesTrader = true
    disagreement = buildDisagreement(userWould, action, intel, opts?.teachRules)
    reasons.push(
      `Behavior match ${behaviorMatch}% would typically BUY — overridden by MarketContext.whaleBias=distributing.`,
    )
  } else if (
    hasDna &&
    opts?.hasOpenPosition &&
    pred.expectedRoiPct >= 12 &&
    intel.whaleBias !== 'distributing' &&
    behaviorMatch >= 55
  ) {
    action = 'WAIT'
    improvesTrader = true
    disagreement = buildDisagreement('SELL', action, intel, opts?.teachRules)
    reasons.push(
      `Hold: expectedROI +${pred.expectedRoiPct}% still open (PredictionEngine) vs your typical early exit.`,
    )
  } else if (
    hasDna &&
    confidence >= 72 &&
    behaviorMatch >= 60 &&
    mq >= 55 &&
    risk < 60 &&
    intel.whaleBias !== 'distributing' &&
    pred.expectedRoiPct > 4
  ) {
    action = 'BUY'
    reasons.push(
      `Matches ${behaviorMatch}% of your historical high-conviction entries (TraderDNA.entryConditionProfile).`,
    )
    if (intel.whaleBias === 'accumulating') {
      reasons.push('Whales accumulated (MarketContext.whaleBias=accumulating).')
    }
    if (intel.liquidityTrend === 'increasing') {
      reasons.push('Liquidity increasing (MarketContext.liquidityTrend).')
    }
  } else if (
    !hasDna &&
    marketConfidence >= 70 &&
    mq >= 55 &&
    risk < 60 &&
    intel.whaleBias !== 'distributing' &&
    pred.expectedRoiPct > 3
  ) {
    // Market-opportunity path — Discovery / untrained wallets
    action = 'BUY'
    reasons.push(
      `Market-quality confidence ${marketConfidence}% · mq ${Math.round(mq)} (no TraderDNA — market mode).`,
    )
    if (intel.whaleBias === 'accumulating') {
      reasons.push('Whale bias accumulating (MarketContext).')
    }
    if (intel.liquidityTrend === 'increasing') {
      reasons.push('Liquidity increasing (MarketContext).')
    }
  } else if (opts?.hasOpenPosition && (intel.whaleBias === 'distributing' || risk >= 65)) {
    action = 'SELL'
    reasons.push('Exit: distribution / risk rising.')
  } else if (mq < 45 || risk >= 65) {
    action = 'WAIT'
    reasons.push('Market quality or risk not aligned — patience preserves edge.')
  } else if (!hasDna && marketConfidence >= 55 && mq >= 48) {
    action = 'WAIT'
    reasons.push(`Watchlist-quality setup (market conf ${marketConfidence}%) — waiting for clearer edge.`)
  } else {
    action = 'DO_NOTHING'
    reasons.push(
      hasDna
        ? 'No clear edge vs TraderDNA × MarketContext composite.'
        : 'No clear market-quality edge yet.',
    )
  }

  opportunity.action = action
  if (!disagreement && improvesTrader) {
    disagreement = buildDisagreement(userWould, action, intel, opts?.teachRules)
  }

  const summary =
    action === 'BUY'
      ? `BUY · ${confidenceMode} conf ${confidence}% · Est. upside +${pred.expectedRoiPct}%`
      : disagreement
        ? `${action} · AI override · ${disagreement.overrideConfidence}%`
        : `${action} · ${confidenceMode} conf ${confidence}%`

  const decision: ExplainableDecision = {
    id: `dec-${intel.tokenSymbol}-${Date.now()}`,
    action,
    scores: {
      behaviorMatch: Math.round(behaviorMatch),
      marketQuality: Math.round(mq),
      risk: Math.round(risk),
      probability,
      expectedRoiPct: pred.expectedRoiPct,
      expectedDrawdownPct: pred.expectedDrawdownPct,
      confidence,
      marketConfidence,
      personalizedConfidence,
      confidenceMode,
      timing: pred.timing,
      executionQuality: Math.round(executionQuality),
    },
    opportunity,
    reasons,
    disagreements: disagreement ? [disagreement.overrideReason] : [],
    disagreement,
    estimatedUpsidePct: pred.expectedRoiPct,
    estimatedDownsidePct: pred.expectedDrawdownPct,
    tokenSymbol: intel.tokenSymbol,
    chain: intel.chain,
    madeAt: new Date().toISOString(),
    improvesTrader,
    summary,
    citations,
    degraded: unavailable.length > 0,
    degradedInputs: unavailable.length ? unavailable : undefined,
  }

  return decision
}

export class DecisionEngine {
  constructor(private readonly bus: TlmEventBus) {}

  evaluate(
    dna: TraderDna | null,
    intel: MarketContext,
    opts?: Parameters<typeof decide>[2],
  ): ExplainableDecision {
    const decision = decide(dna, intel, opts)
    this.bus.publish(
      'OpportunityScored',
      { token: intel.tokenSymbol, opportunity: decision.opportunity },
      'DecisionEngine',
    )
    this.bus.publish(
      'DecisionMade',
      {
        action: decision.action,
        confidence: decision.scores.confidence,
        id: decision.id,
        improvesTrader: decision.improvesTrader,
      },
      'DecisionEngine',
    )
    if (decision.disagreement) {
      this.bus.publish('DisagreementRaised', decision.disagreement, 'DecisionEngine')
    }
    return decision
  }
}
