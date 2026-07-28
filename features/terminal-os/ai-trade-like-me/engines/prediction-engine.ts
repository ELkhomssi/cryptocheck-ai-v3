/**
 * Prediction Engine — expected upside / drawdown from DNA + MarketContext.
 */

import type { MarketContext, TraderDna } from '../types'

export interface PredictionOutcome {
  expectedRoiPct: number
  expectedDrawdownPct: number
  probability: number
  timing: number
  horizonLabel: string
}

export function predictOpportunity(
  dna: TraderDna | null,
  intel: MarketContext,
): PredictionOutcome {
  const styleBoost =
    dna &&
    ((dna.styleVector.momentum > 0.2 || dna.styleVector.breakoutTrader > 0.15) &&
      intel.orderFlowBias === 'buy')
      ? 4
      : dna && dna.styleVector.whaleFollower > 0.2 && intel.whaleBias === 'accumulating'
        ? 5
        : 0

  const expectedRoiPct = Number(
    (intel.predictionUpsidePct + styleBoost * 0.5 + (dna?.avgRoiPct ?? 0) * 0.15).toFixed(1),
  )
  const expectedDrawdownPct = Number(
    Math.max(3, intel.volatilityPct * 0.55 + intel.riskScore * 0.08).toFixed(1),
  )
  const probability = Math.round(
    Math.max(
      18,
      Math.min(
        92,
        48 +
          (intel.whaleBias === 'accumulating' ? 12 : intel.whaleBias === 'distributing' ? -14 : 0) +
          (intel.liquidityTrend === 'increasing' ? 8 : intel.liquidityTrend === 'decreasing' ? -10 : 0) +
          (dna ? dna.confidence * 0.15 : 0),
      ),
    ),
  )
  const timing = Math.round(
    Math.max(
      10,
      Math.min(
        95,
        50 +
          (intel.orderFlowBias === 'buy' ? 15 : intel.orderFlowBias === 'sell' ? -15 : 0) -
          intel.volatilityPct * 0.4,
      ),
    ),
  )

  const horizon =
    dna && dna.styleVector.scalper > 0.3
      ? 'minutes–hours'
      : dna && dna.styleVector.swingTrader > 0.3
        ? 'days'
        : 'hours–day'

  return {
    expectedRoiPct,
    expectedDrawdownPct,
    probability,
    timing,
    horizonLabel: horizon,
  }
}

export class PredictionEngine {
  predict(dna: TraderDna | null, intel: MarketContext) {
    return predictOpportunity(dna, intel)
  }
}
