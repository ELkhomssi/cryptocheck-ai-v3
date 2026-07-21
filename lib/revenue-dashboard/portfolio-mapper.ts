import type { Portfolio as TrackerPortfolio, PortfolioPosition as TrackerPosition } from '@/lib/portfolio/portfolio-tracker'
import { terminalExitDeepLink } from './constants'
import type { PortfolioPosition, RevenueVerdict } from './types'

export function verdictFromRiskScore(riskScore: number): RevenueVerdict {
  if (riskScore >= 60) return 'DANGER'
  if (riskScore >= 31) return 'CAUTION'
  return 'SAFE'
}

export function isFlaggedVerdict(verdict: RevenueVerdict): boolean {
  return verdict === 'CAUTION' || verdict === 'DANGER'
}

export function mapTrackerPosition(p: TrackerPosition, totalValueUsd: number, scannedAt: string): PortfolioPosition {
  const verdict = verdictFromRiskScore(p.riskScore)
  return {
    mint: p.mint,
    symbol: p.symbol,
    name: p.symbol,
    balance: p.amountTokens,
    valueUsd: p.valueUsd,
    safetyScore: Math.max(0, Math.min(100, 100 - p.riskScore)),
    riskScore: p.riskScore,
    verdict,
    concentrationPct: totalValueUsd > 0 ? (p.valueUsd / totalValueUsd) * 100 : 0,
    scannedAt,
    estimated: p.estimated,
    avgEntryPriceUsd: p.avgEntryPriceUsd,
    currentPriceUsd: p.currentPriceUsd,
    pnlUsd: p.pnlUsd,
    pnlPct: p.pnlPct,
  }
}

export type RevenuePortfolioSummary = {
  walletAddress: string
  totalValueUsd: number
  holdingCount: number
  flaggedCount: number
  flaggedValueUsd: number
  flaggedPct: number
  exposure: TrackerPortfolio['riskExposure']
  positions: PortfolioPosition[]
  lastUpdatedAt: string
  /** Book P&L when entry basis is known (partial if estimated). */
  totalPnlUsd?: number
  totalPnlPct?: number
}

export function mapTrackerPortfolio(portfolio: TrackerPortfolio): RevenuePortfolioSummary {
  const positions = portfolio.positions
    .map((p) => mapTrackerPosition(p, portfolio.totalValueUsd, portfolio.lastUpdatedAt))
    .sort((a, b) => b.riskScore - a.riskScore)

  const flagged = positions.filter((p) => isFlaggedVerdict(p.verdict))
  const flaggedValueUsd = flagged.reduce((a, p) => a + p.valueUsd, 0)

  return {
    walletAddress: portfolio.walletAddress,
    totalValueUsd: portfolio.totalValueUsd,
    holdingCount: positions.length,
    flaggedCount: flagged.length,
    flaggedValueUsd,
    flaggedPct: portfolio.totalValueUsd > 0 ? (flaggedValueUsd / portfolio.totalValueUsd) * 100 : 0,
    exposure: portfolio.riskExposure,
    positions,
    lastUpdatedAt: portfolio.lastUpdatedAt,
    totalPnlUsd: portfolio.totalPnlUsd,
    totalPnlPct: portfolio.totalPnlPct,
  }
}

export function swapToSafetyHref(mint: string, balance?: number): string {
  if (balance != null && balance > 0) {
    return `${terminalExitDeepLink(mint)}&amount=${encodeURIComponent(String(balance))}`
  }
  return terminalExitDeepLink(mint)
}
