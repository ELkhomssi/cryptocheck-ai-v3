import 'server-only'

import { alertDedupeId, defaultTitleForType } from '@/lib/portfolio-desk/alert-classify'
import { pushAlert } from '@/lib/portfolio-desk/alerts-store'
import { fetchNewListings, fetchTrending } from '@/lib/providers/birdeye'
import { computeSmartMoneyScore } from '@/lib/terminal/scoring'
import type { PortfolioAlert } from '@/types/portfolio-desk'

/**
 * Poll Birdeye for new listings + smart-money-trending and write via pushAlert.
 * Honest: only emits when Birdeye returns real rows; never fabricates.
 * Dedupes with signature-like keys (source + mint + type).
 */
export async function pollBirdeyeMarketAlerts(opts?: {
  newListingLimit?: number
  smartMoneyLimit?: number
  smartMoneyMinScore?: number
}): Promise<{ written: number; skipped: number }> {
  const newLim = opts?.newListingLimit ?? 5
  const smLim = opts?.smartMoneyLimit ?? 5
  const minScore = opts?.smartMoneyMinScore ?? 60
  let written = 0
  let skipped = 0

  const listings = await fetchNewListings(newLim)
  for (const row of listings) {
    if (!row.mint) {
      skipped += 1
      continue
    }
    const type = 'new_listing' as const
    const alert: PortfolioAlert = {
      id: alertDedupeId({
        signature: `birdeye:new:${row.mint}:${row.createdAt || 0}`,
        type,
        mint: row.mint,
      }),
      type,
      title: defaultTitleForType(type),
      description: `${row.symbol || row.name || 'Token'} listed · liq≈$${Math.round(row.liquidityUsd).toLocaleString()}`,
      severity: 'info',
      tokenSymbol: row.symbol || null,
      mint: row.mint,
      createdAt: new Date().toISOString(),
    }
    await pushAlert(alert)
    written += 1
  }

  const trending = await fetchTrending(Math.max(smLim, 10))
  const ranked = [...trending]
    .map((t) => ({ ...t, score: computeSmartMoneyScore(t) }))
    .filter((t) => t.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, smLim)

  for (const t of ranked) {
    const type = 'smart_money_entry' as const
    const alert: PortfolioAlert = {
      id: alertDedupeId({
        signature: `birdeye:sm:${t.mint}:${Math.floor(Date.now() / 3_600_000)}`,
        type,
        mint: t.mint,
      }),
      type,
      title: defaultTitleForType(type),
      description: `${t.symbol || 'Token'} smart-money score ${t.score} · vol24h≈$${Math.round(t.volume24hUsd).toLocaleString()}`,
      severity: 'info',
      tokenSymbol: t.symbol || null,
      mint: t.mint,
      createdAt: new Date().toISOString(),
    }
    await pushAlert(alert)
    written += 1
  }

  return { written, skipped }
}
