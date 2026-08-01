/**
 * Decision Engine V2 — inspectable sub-scores + computeConfidence.
 * Cosine similarity for behaviorMatch. LLM never generates confidence.
 */

import type { EngineId } from '@cryptocheck/decision-contracts'
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
import { computeConfidence, cosineSimilarity } from '../lib/scoring'
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
    /** Layer 1 engines unavailable — Decision still emits, confidence penalized */
    unavailableEngines?: EngineId[]
  },
): ExplainableDecision {
  const prefs = opts?.weightPrefs ?? DEFAULT_WEIGHT_PREFS
  const unavailable = opts?.unavailableEngines ?? []
  const pred = predictOpportunity(dna, intel)
  const citations: ScoreCitation[] = []

  const behaviorMatch = dna
    ? cosineSimilarity(dnaConditionVector(dna), intel.conditionVector)
    : 35
  citations.push({
    source: 'TraderDNA',
    field: 'entryConditionProfile',
    value: behaviorMatch,
    contribution: dna
      ? `cosine similarity ${behaviorMatch}% vs entry profile`
      : 'TraderDNA unavailable — neutral behaviorMatch baseline',
  })

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

  let confidence = computeConfidence(
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
  // Partial Layer 1 input: never block; lower confidence-to-act explicitly
  if (unavailable.length) {
    const penalty = Math.min(35, unavailable.length * 8)
    confidence = clamp(confidence - penalty, 5, 95)
    citations.push({
      source: 'MarketContext',
      field: 'degradedInputs',
      value: unavailable.length,
      contribution: `degraded Layer 1 inputs: ${unavailable.join(', ')} (−${penalty} conf)`,
    })
  }
  citations.push({
    source: 'Weights',
    field: 'computeConfidence',
    value: confidence,
    contribution: `prefs bm=${prefs.behaviorMatch} mq=${prefs.marketQuality} riskPenalty=${prefs.riskPenalty}`,
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
      `Degraded inputs: ${unavailable.join(', ')} — confidence reduced; Decision still emitted.`,
    )
  }

  if (intel.securityBand === 'danger' || risk >= 78) {
    action = opts?.hasOpenPosition ? 'EXIT' : 'DO_NOTHING'
    reasons.push(
      `Security band ${intel.securityBand} · riskScore ${risk} — capital protection first (MarketContext.riskScore).`,
    )
    improvesTrader = true
  } else if (intel.whaleBias === 'distributing' && userWould === 'BUY') {
    action = 'WAIT'
    improvesTrader = true
    disagreement = buildDisagreement(userWould, action, intel, opts?.teachRules)
    reasons.push(
      `Behavior match ${behaviorMatch}% would typically BUY — overridden by MarketContext.whaleBias=distributing.`,
    )
    reasons.push('AI recommends waiting — improve the trader, do not imitate FOMO.')
  } else if (
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
    confidence >= 72 &&
    behaviorMatch >= 60 &&
    mq >= 55 &&
    risk < 60 &&
    intel.whaleBias !== 'distributing' &&
    pred.expectedRoiPct > 4
  ) {
    action = 'BUY'
    const holdH = dna ? (dna.avgHoldingMs / 3_600_000).toFixed(1) : '?'
    reasons.push(
      `Matches ${behaviorMatch}% of your historical high-conviction entries (TraderDNA.entryConditionProfile).`,
    )
    if (intel.whaleBias === 'accumulating') {
      reasons.push('Whales accumulated (MarketContext.whaleBias=accumulating).')
    }
    if (intel.liquidityTrend === 'increasing') {
      reasons.push('Liquidity increasing (MarketContext.liquidityTrend).')
    }
    reasons.push(
      `Your typical hold window ~${holdH}h (TraderDNA.avgHoldingMs=${dna?.avgHoldingMs ?? 0}).`,
    )
    if (dna && dna.riskAppetite < 50 && risk > 40) {
      reasons.push(
        `Deviation flag: risk band ${risk} vs your riskAppetite ${dna.riskAppetite}/100.`,
      )
    }
    citations.push({
      source: 'TraderDNA',
      field: 'confidence',
      value: dna?.confidence ?? 0,
      contribution: 'DNA retention confidence',
    })
  } else if (opts?.hasOpenPosition && (intel.whaleBias === 'distributing' || risk >= 65)) {
    action = 'SELL'
    reasons.push('Exit: distribution / risk rising vs discipline profile.')
  } else if (mq < 45 || risk >= 65) {
    action = 'WAIT'
    reasons.push('Market quality or risk not aligned — patience preserves edge.')
  } else {
    action = 'DO_NOTHING'
    reasons.push('No clear edge vs TraderDNA × MarketContext composite.')
  }

  opportunity.action = action
  if (!disagreement && improvesTrader) {
    disagreement = buildDisagreement(userWould, action, intel, opts?.teachRules)
  }

  const summary =
    action === 'BUY'
      ? `BUY · Confidence ${confidence}% · Est. upside +${pred.expectedRoiPct}%`
      : disagreement
        ? `${action} · AI override · ${disagreement.overrideConfidence}%`
        : `${action} · Confidence ${confidence}%`

  const decision: ExplainableDecision = {
    id: `dec-${intel.tokenSymbol}-${Date.now()}`,
    action,
    scores: {
      behaviorMatch: opportunity.behaviorMatch,
      marketQuality: opportunity.marketQuality,
      risk: opportunity.risk,
      probability: opportunity.probability,
      expectedRoiPct: opportunity.expectedRoiPct,
      expectedDrawdownPct: opportunity.expectedDrawdownPct,
      confidence,
      timing: opportunity.timing,
      executionQuality: opportunity.executionQuality,
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
    const unavailable = [...(opts?.unavailableEngines ?? [])]
    if (!dna && !unavailable.includes('trader-dna')) unavailable.push('trader-dna')
    const decision = decide(dna, intel, { ...opts, unavailableEngines: unavailable })
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
        degraded: unavailable.length > 0,
        degradedInputs: unavailable,
      },
      'DecisionEngine',
    )
    if (decision.disagreement) {
      this.bus.publish('DisagreementRaised', decision.disagreement, 'DecisionEngine')
    }
    return decision
  }
}
