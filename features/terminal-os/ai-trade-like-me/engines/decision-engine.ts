/**
 * Decision Engine — combines Trader DNA + Market Intel + Predictions.
 * Philosophy: improve the trader, do not imitate blindly.
 */

import type {
  DecisionScores,
  ExplainableDecision,
  MarketIntelSnapshot,
  TlmDecisionAction,
  TraderDna,
} from '../types'
import { predictOpportunity } from './prediction-engine'
import type { TlmEventBus } from './event-bus'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function behaviorMatch(dna: TraderDna | null, intel: MarketIntelSnapshot): number {
  if (!dna) return 35
  let score = 40
  if (dna.favoriteChains.some((c) => c.chain === intel.chain)) score += 12
  if (dna.styles.some((s) => s.tag === 'whale_follower') && intel.whaleBias === 'accumulating') {
    score += 18
  }
  if (dna.styles.some((s) => s.tag === 'momentum') && intel.orderFlowBias === 'buy') score += 14
  if (dna.styles.some((s) => s.tag === 'liquidity_hunter') && intel.liquidityTrend === 'increasing') {
    score += 12
  }
  if (dna.riskAppetite === 'conservative' && intel.riskScore > 55) score -= 20
  if (dna.riskAppetite === 'degen' && intel.volatilityPct > 10) score += 8
  return clamp(score, 5, 98)
}

function marketQuality(intel: MarketIntelSnapshot): number {
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

export function decide(
  dna: TraderDna | null,
  intel: MarketIntelSnapshot,
  opts?: { hasOpenPosition?: boolean },
): ExplainableDecision {
  const pred = predictOpportunity(dna, intel)
  const bm = behaviorMatch(dna, intel)
  const mq = marketQuality(intel)
  const risk = intel.riskScore
  const executionQuality = clamp(
    70 -
      (intel.volatilityPct > 20 ? 15 : 0) +
      (intel.liquidityTrend === 'increasing' ? 10 : 0),
    20,
    95,
  )

  const scores: DecisionScores = {
    behaviorMatch: Math.round(bm),
    marketQuality: Math.round(mq),
    risk: Math.round(risk),
    probability: pred.probability,
    expectedRoiPct: pred.expectedRoiPct,
    expectedDrawdownPct: pred.expectedDrawdownPct,
    confidence: Math.round(
      clamp(bm * 0.35 + mq * 0.35 + pred.probability * 0.2 + (dna?.confidenceScore ?? 30) * 0.1, 8, 97),
    ),
    timing: pred.timing,
    executionQuality: Math.round(executionQuality),
  }

  const reasons: string[] = []
  const disagreements: string[] = []
  let action: TlmDecisionAction = 'DO_NOTHING'
  let improvesTrader = false

  const habitBuy =
    bm >= 55 ||
    Boolean(
      dna?.styles.some((s) => s.tag === 'whale_follower' || s.tag === 'momentum' || s.tag === 'breakout'),
    )

  // Security veto
  if (intel.securityBand === 'danger' || risk >= 78) {
    action = opts?.hasOpenPosition ? 'EXIT' : 'DO_NOTHING'
    reasons.push('Security / risk engine flags elevated danger — capital protection first.')
    improvesTrader = true
  } else if (intel.whaleBias === 'distributing' && habitBuy) {
    // Adaptive disagreement: user style says buy, whales distributing
    action = 'WAIT'
    disagreements.push(
      'Normally you would buy here (high behavior match), however whales are distributing and liquidity quality is softening.',
    )
    reasons.push('AI recommends waiting — improve entry, do not imitate FOMO.')
    improvesTrader = true
  } else if (
    opts?.hasOpenPosition &&
    pred.expectedRoiPct >= 12 &&
    intel.whaleBias !== 'distributing' &&
    bm >= 55
  ) {
    action = 'WAIT'
    disagreements.push(
      `Normally you might sell now. AI predicts another ~+${pred.expectedRoiPct}% upside with acceptable risk.`,
    )
    reasons.push('Recommendation: Hold Position — AI improves the trader, not copies exits.')
    improvesTrader = true
  } else if (
    scores.confidence >= 72 &&
    bm >= 65 &&
    mq >= 58 &&
    risk < 60 &&
    intel.whaleBias !== 'distributing' &&
    pred.expectedRoiPct > 4
  ) {
    action = 'BUY'
    reasons.push(
      `This opportunity matches ${bm}% of your historical behavior.`,
    )
    if (intel.whaleBias === 'accumulating') reasons.push('Whales accumulated.')
    if (intel.liquidityTrend === 'increasing') reasons.push('Liquidity increasing.')
    if (intel.walletQuality >= 60) reasons.push('Holder quality improving.')
    reasons.push('Risk acceptable relative to your loss tolerance.')
  } else if (opts?.hasOpenPosition && (intel.whaleBias === 'distributing' || risk >= 65)) {
    action = 'SELL'
    reasons.push('Exit signal: distribution / risk rising vs your discipline profile.')
  } else if (mq < 45 || risk >= 65) {
    action = 'WAIT'
    reasons.push('Market quality or risk not yet aligned — patience preserves edge.')
  } else {
    action = 'DO_NOTHING'
    reasons.push('No clear edge vs your DNA + live intelligence composite.')
  }

  const summary =
    action === 'BUY'
      ? `BUY · Confidence ${scores.confidence}% · Est. upside +${pred.expectedRoiPct}%`
      : action === 'WAIT' && improvesTrader
        ? `WAIT · AI overrides typical habit to protect / improve outcome`
        : `${action} · Confidence ${scores.confidence}%`

  return {
    id: `dec-${intel.tokenSymbol}-${Date.now()}`,
    action,
    scores,
    reasons,
    disagreements,
    estimatedUpsidePct: pred.expectedRoiPct,
    estimatedDownsidePct: pred.expectedDrawdownPct,
    tokenSymbol: intel.tokenSymbol,
    chain: intel.chain,
    madeAt: new Date().toISOString(),
    improvesTrader,
    summary,
  }
}

export class DecisionEngine {
  constructor(private readonly bus: TlmEventBus) {}

  evaluate(
    dna: TraderDna | null,
    intel: MarketIntelSnapshot,
    opts?: { hasOpenPosition?: boolean },
  ): ExplainableDecision {
    const decision = decide(dna, intel, opts)
    this.bus.publish(
      'tlm.decision.made',
      { action: decision.action, confidence: decision.scores.confidence, id: decision.id },
      'DecisionEngine',
    )
    this.bus.publish(
      'tlm.opportunity.scored',
      { token: intel.tokenSymbol, scores: decision.scores },
      'DecisionEngine',
    )
    return decision
  }
}
