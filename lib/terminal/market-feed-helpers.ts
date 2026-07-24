/** Pure market-feed helpers — safe for unit tests (no server-only / provider imports). */

import type { NewPool, ScreenerRow, TokenMarketMetrics } from '@/lib/providers/types'

export type MarketFeedResponse = {
  items: ScreenerRow[] | TokenMarketMetrics[]
  fetchedAt: string
  source: string
  error?: string
}

export const BIRDEYE_KEY_MISSING = 'BIRDEYE_API_KEY not configured'

/** Honest empty payload when Birdeye is not configured (HTTP 200). */
export function buildUnavailableMarketFeed(
  fetchedAt: string = new Date().toISOString(),
): MarketFeedResponse {
  return {
    items: [],
    fetchedAt,
    source: 'unavailable',
    error: BIRDEYE_KEY_MISSING,
  }
}

export function buildOkMarketFeed(
  items: ScreenerRow[] | TokenMarketMetrics[],
  source: string,
  fetchedAt: string = new Date().toISOString(),
): MarketFeedResponse {
  return { items, fetchedAt, source }
}

export function hasBirdeyeApiKey(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.BIRDEYE_API_KEY?.trim())
}

/** Prefer first-seen mint; later sources fill gaps only. */
export function mergeNewPoolsByMint(...lists: NewPool[][]): NewPool[] {
  const byMint = new Map<string, NewPool>()
  for (const list of lists) {
    for (const pool of list) {
      if (!pool.mint) continue
      const prev = byMint.get(pool.mint)
      if (!prev) {
        byMint.set(pool.mint, pool)
        continue
      }
      // Keep richer metadata / higher liquidity / earlier createdAt
      byMint.set(pool.mint, {
        ...prev,
        symbol: prev.symbol || pool.symbol,
        name: prev.name || pool.name,
        poolAddress: prev.poolAddress || pool.poolAddress,
        liquidityUsd: Math.max(prev.liquidityUsd, pool.liquidityUsd),
        createdAt:
          prev.createdAt > 0 && pool.createdAt > 0
            ? Math.min(prev.createdAt, pool.createdAt)
            : prev.createdAt || pool.createdAt,
        source: prev.source === pool.source ? prev.source : `${prev.source}+${pool.source}`,
      })
    }
  }
  return [...byMint.values()].sort((a, b) => b.createdAt - a.createdAt)
}

export function metricsToScreenerRow(
  m: TokenMarketMetrics,
  flags: Partial<
    Pick<
      ScreenerRow,
      | 'riskScore'
      | 'aiScore'
      | 'isPumpFun'
      | 'isRaydium'
      | 'isGraduated'
      | 'isVerified'
      | 'isTrending'
      | 'smartMoneyScore'
    >
  > = {},
): ScreenerRow {
  return {
    ...m,
    riskScore: flags.riskScore ?? 0,
    aiScore: flags.aiScore ?? 0,
    isPumpFun: flags.isPumpFun ?? false,
    isRaydium: flags.isRaydium ?? false,
    isGraduated: flags.isGraduated ?? false,
    isVerified: flags.isVerified ?? false,
    isTrending: flags.isTrending ?? false,
    smartMoneyScore: flags.smartMoneyScore ?? 0,
  }
}

export function newPoolToScreenerRow(pool: NewPool): ScreenerRow {
  return metricsToScreenerRow(
    {
      mint: pool.mint,
      symbol: pool.symbol || undefined,
      name: pool.name || undefined,
      priceUsd: 0,
      change5mPct: 0,
      change1hPct: 0,
      change24hPct: 0,
      volume24hUsd: 0,
      liquidityUsd: pool.liquidityUsd,
      marketCapUsd: 0,
      fdvUsd: 0,
      holders: 0,
      txCount24h: 0,
      buySellRatio: 0,
    },
    {
      isRaydium: pool.source.includes('raydium'),
      isPumpFun: pool.source.includes('birdeye'),
    },
  )
}

/**
 * Graduated selection:
 * 1) Prefer rows with isGraduated === true (Birdeye field when present).
 * 2) Else if any row exposes a graduation timestamp-like field via created ordering,
 *    callers may pre-sort; this helper only filters the boolean.
 * 3) Fallback (caller): new listings with liquidityUsd > GRADUATED_LIQUIDITY_FALLBACK_USD.
 */
export const GRADUATED_LIQUIDITY_FALLBACK_USD = 50_000

export function filterGraduatedRows(rows: ScreenerRow[]): ScreenerRow[] {
  return rows.filter((r) => r.isGraduated)
}

export function filterHighLiquidityPools(
  pools: NewPool[],
  minLiquidityUsd: number = GRADUATED_LIQUIDITY_FALLBACK_USD,
): NewPool[] {
  return pools.filter((p) => p.liquidityUsd > minLiquidityUsd)
}
