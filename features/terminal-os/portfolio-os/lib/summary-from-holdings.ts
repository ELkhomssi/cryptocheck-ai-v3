/**
 * Portfolio Intelligence summary — keep in sync with PortfolioOverviewPanel.
 * Pure derivation from live HoldingsResponse (no fabricated figures).
 */

import type { HoldingsResponse } from '@/types/portfolio-desk'
import type { PortfolioHealthSummary } from '@/features/terminal-os/shared/types'

export function summaryFromHoldings(h: HoldingsResponse): PortfolioHealthSummary {
  const n = h.holdings.length
  const topShare = n ? Math.max(...h.holdings.map((x) => x.allocationPct)) : 0
  const diversificationScore = Math.max(
    5,
    Math.min(95, Math.round(100 - topShare * 0.7 + Math.min(n, 12) * 2)),
  )
  const avgAbsChg =
    n > 0 ? h.holdings.reduce((s, x) => s + Math.abs(x.change24hPct ?? 0), 0) / n : 0
  const pnl24hPct =
    h.totalValueUsd > 0
      ? h.holdings.reduce((s, x) => s + ((x.change24hPct ?? 0) * x.valueUsd) / h.totalValueUsd, 0)
      : 0
  const pnl24hUsd = (pnl24hPct / 100) * h.totalValueUsd
  const stabilityScore = Math.max(5, Math.min(95, Math.round(80 - avgAbsChg)))
  const aiHealthScore = Math.round((diversificationScore + stabilityScore) / 2)

  return {
    totalAssetsUsd: h.totalValueUsd,
    pnl24hUsd,
    pnl24hPct,
    diversificationScore,
    aiHealthScore,
    stabilityScore,
    healthWhy:
      n === 0
        ? 'No token holdings detected for this wallet yet.'
        : `Derived from ${n} live holdings via portfolio holdings API.`,
    stabilityWhy:
      avgAbsChg > 12
        ? '24h price swings are elevated across holdings.'
        : 'Holdings show moderate 24h movement vs peers.',
  }
}
