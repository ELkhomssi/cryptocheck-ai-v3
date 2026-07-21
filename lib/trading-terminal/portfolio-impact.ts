/**
 * Portfolio impact — before/after exposure from real portfolio + ticket amount.
 * Never fabricates portfolio totals.
 */

export type PortfolioRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type PortfolioImpact = {
  metric: string
  beforePct: number | null
  afterPct: number | null
  riskLevel: PortfolioRiskLevel | null
  observations: string[]
  /** True when portfolio or ticket inputs missing. */
  awaiting: boolean
}

export function computePortfolioImpact(input: {
  portfolioTotalUsd: number
  /** Current position value in focused mint (USD). */
  currentPositionUsd: number
  /** Intended add in USD (ticket × SOL price). */
  ticketUsd: number | null
  side: 'buy' | 'sell'
}): PortfolioImpact {
  if (!(input.portfolioTotalUsd > 0)) {
    return {
      metric: 'Focused token exposure',
      beforePct: null,
      afterPct: null,
      riskLevel: null,
      observations: [],
      awaiting: true,
    }
  }

  const beforePct = (input.currentPositionUsd / input.portfolioTotalUsd) * 100
  let afterPct: number | null = null
  const observations: string[] = []

  if (input.ticketUsd == null || !(input.ticketUsd > 0)) {
    return {
      metric: 'Focused token exposure',
      beforePct,
      afterPct: null,
      riskLevel: riskFromPct(beforePct),
      observations: ['Set ticket amount to project after-trade exposure.'],
      awaiting: false,
    }
  }

  if (input.side === 'buy') {
    const newTotal = input.portfolioTotalUsd // treat ticket as redeployed cash approximation
    const afterPos = input.currentPositionUsd + input.ticketUsd
    afterPct = (afterPos / Math.max(newTotal, afterPos)) * 100
  } else {
    const afterPos = Math.max(0, input.currentPositionUsd - input.ticketUsd)
    afterPct = (afterPos / input.portfolioTotalUsd) * 100
  }

  const riskLevel = riskFromPct(afterPct ?? beforePct)

  if (afterPct != null && afterPct - beforePct >= 10) {
    observations.push('Exposure becomes more concentrated.')
  } else if (afterPct != null && afterPct < 15) {
    observations.push('Position size remains modest vs book.')
  } else {
    observations.push('Risk remains within prior band.')
  }

  if (riskLevel === 'HIGH') {
    observations.push('After-trade concentration is elevated.')
  }

  return {
    metric: 'Focused token exposure',
    beforePct,
    afterPct,
    riskLevel,
    observations: observations.slice(0, 3),
    awaiting: false,
  }
}

function riskFromPct(pct: number): PortfolioRiskLevel {
  if (pct >= 35) return 'HIGH'
  if (pct >= 15) return 'MEDIUM'
  return 'LOW'
}
