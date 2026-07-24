import 'server-only'

/**
 * Phase 10.2 — thin server helpers for independently-cached market feed routes.
 * Provider clients already TTL-cache; each feed adds its own composed cache key.
 */

import { cachedJson } from '@/lib/cache/ttl'
import {
  fetchNewListings,
  fetchNewPools,
  fetchTokenList,
  fetchTokenMetricsFromDex,
  fetchTokenOverview,
  fetchTrending,
} from '@/lib/providers'
import type { NewPool, ScreenerRow } from '@/lib/providers/types'
import {
  buildOkMarketFeed,
  buildUnavailableMarketFeed,
  filterGraduatedRows,
  filterHighLiquidityPools,
  GRADUATED_LIQUIDITY_FALLBACK_USD,
  hasBirdeyeApiKey,
  mergeNewPoolsByMint,
  metricsToScreenerRow,
  newPoolToScreenerRow,
  type MarketFeedResponse,
} from '@/lib/terminal/market-feed-helpers'

export type { MarketFeedResponse } from '@/lib/terminal/market-feed-helpers'
export {
  buildUnavailableMarketFeed,
  BIRDEYE_KEY_MISSING,
  GRADUATED_LIQUIDITY_FALLBACK_USD,
  hasBirdeyeApiKey,
  mergeNewPoolsByMint,
} from '@/lib/terminal/market-feed-helpers'

const FEED_TTL_SEC = 20
const LIMIT = 20

function unavailable(): MarketFeedResponse {
  return buildUnavailableMarketFeed()
}

async function enrichMintToScreener(
  mint: string,
  seed?: Partial<ScreenerRow>,
): Promise<ScreenerRow | null> {
  // ~80–150ms estimated per mint (Birdeye overview; DexScreener only on miss)
  const overview = await fetchTokenOverview(mint)
  if (overview) {
    return metricsToScreenerRow(overview, {
      isPumpFun: seed?.isPumpFun,
      isRaydium: seed?.isRaydium,
      isGraduated: seed?.isGraduated,
      isVerified: seed?.isVerified,
      isTrending: seed?.isTrending,
      smartMoneyScore: seed?.smartMoneyScore,
    })
  }
  const dex = await fetchTokenMetricsFromDex(mint)
  if (dex) {
    return metricsToScreenerRow(dex, {
      isPumpFun: seed?.isPumpFun,
      isRaydium: seed?.isRaydium,
      isGraduated: seed?.isGraduated,
      isVerified: seed?.isVerified,
      isTrending: seed?.isTrending,
      smartMoneyScore: seed?.smartMoneyScore,
    })
  }
  return null
}

async function enrichPools(pools: NewPool[], limit: number): Promise<ScreenerRow[]> {
  const sliced = pools.slice(0, limit)
  // ~80–150ms estimated per mint; fan-out capped at limit (≤20)
  const rows = await Promise.all(
    sliced.map(async (pool) => {
      const seed = newPoolToScreenerRow(pool)
      const enriched = await enrichMintToScreener(pool.mint, seed)
      return enriched ?? seed
    }),
  )
  return rows
}

/** GET gainers — token list sorted by 24h change desc. */
export async function getGainersFeed(limit = LIMIT): Promise<MarketFeedResponse> {
  if (!hasBirdeyeApiKey()) return unavailable()
  const lim = Math.min(Math.max(1, Math.floor(limit)), LIMIT)
  return cachedJson(`market:feed:gainers:${lim}`, FEED_TTL_SEC, async () => {
    const items = await fetchTokenList({
      sortBy: 'v24hChangePercent',
      sortType: 'desc',
      limit: lim,
    })
    return buildOkMarketFeed(items.slice(0, lim), 'birdeye')
  })
}

/** GET losers — token list sorted by 24h change asc. */
export async function getLosersFeed(limit = LIMIT): Promise<MarketFeedResponse> {
  if (!hasBirdeyeApiKey()) return unavailable()
  const lim = Math.min(Math.max(1, Math.floor(limit)), LIMIT)
  return cachedJson(`market:feed:losers:${lim}`, FEED_TTL_SEC, async () => {
    const items = await fetchTokenList({
      sortBy: 'v24hChangePercent',
      sortType: 'asc',
      limit: lim,
    })
    return buildOkMarketFeed(items.slice(0, lim), 'birdeye')
  })
}

/** GET trending — Birdeye fetchTrending. */
export async function getTrendingFeed(limit = LIMIT): Promise<MarketFeedResponse> {
  if (!hasBirdeyeApiKey()) return unavailable()
  const lim = Math.min(Math.max(1, Math.floor(limit)), LIMIT)
  return cachedJson(`market:feed:trending:${lim}`, FEED_TTL_SEC, async () => {
    const items = await fetchTrending(lim)
    return buildOkMarketFeed(items, 'birdeye')
  })
}

/** GET new-launches — Birdeye + Raydium merge/dedupe by mint. */
export async function getNewLaunchesFeed(limit = LIMIT): Promise<MarketFeedResponse> {
  if (!hasBirdeyeApiKey()) return unavailable()
  const lim = Math.min(Math.max(1, Math.floor(limit)), LIMIT)
  return cachedJson(`market:feed:new-launches:${lim}`, FEED_TTL_SEC, async () => {
    const [birdeye, raydium] = await Promise.all([
      fetchNewListings(lim),
      fetchNewPools(lim),
    ])
    const merged = mergeNewPoolsByMint(birdeye, raydium).slice(0, lim)
    const items = await enrichPools(merged, lim)
    return buildOkMarketFeed(items, 'birdeye+raydium')
  })
}

/**
 * GET graduated — prefer Birdeye isGraduated rows.
 * Fallback: new listings with liquidityUsd > GRADUATED_LIQUIDITY_FALLBACK_USD ($50k)
 * when the API does not expose graduation flags / timestamps.
 */
export async function getGraduatedFeed(limit = LIMIT): Promise<MarketFeedResponse> {
  if (!hasBirdeyeApiKey()) return unavailable()
  const lim = Math.min(Math.max(1, Math.floor(limit)), LIMIT)
  return cachedJson(`market:feed:graduated:${lim}`, FEED_TTL_SEC, async () => {
    const listed = await fetchTokenList({
      sortBy: 'v24hUSD',
      sortType: 'desc',
      limit: 50,
      minLiquidity: GRADUATED_LIQUIDITY_FALLBACK_USD,
    })
    let graduated = filterGraduatedRows(listed)
    if (graduated.length) {
      return buildOkMarketFeed(graduated.slice(0, lim), 'birdeye')
    }

    const fresh = await fetchNewListings(50)
    const highLiq = filterHighLiquidityPools(fresh, GRADUATED_LIQUIDITY_FALLBACK_USD)
    const items = await enrichPools(highLiq, lim)
    return buildOkMarketFeed(items, 'birdeye:liquidity-fallback')
  })
}

/** GET volume — token list sort by volume24hUSD desc. */
export async function getVolumeFeed(limit = LIMIT): Promise<MarketFeedResponse> {
  if (!hasBirdeyeApiKey()) return unavailable()
  const lim = Math.min(Math.max(1, Math.floor(limit)), LIMIT)
  return cachedJson(`market:feed:volume:${lim}`, FEED_TTL_SEC, async () => {
    const items = await fetchTokenList({
      sortBy: 'v24hUSD',
      sortType: 'desc',
      limit: lim,
    })
    return buildOkMarketFeed(items.slice(0, lim), 'birdeye')
  })
}

/**
 * GET smart-money — best-effort: trending rows with smartMoneyScore from ScreenerRow mapping.
 * Never fabricates whale wallets; score stays 0 when Birdeye omits smart-money fields.
 */
export async function getSmartMoneyFeed(limit = LIMIT): Promise<MarketFeedResponse> {
  if (!hasBirdeyeApiKey()) return unavailable()
  const lim = Math.min(Math.max(1, Math.floor(limit)), LIMIT)
  return cachedJson(`market:feed:smart-money:${lim}`, FEED_TTL_SEC, async () => {
    const trending = await fetchTrending(lim)
    const items = [...trending].sort(
      (a, b) => (b.smartMoneyScore ?? 0) - (a.smartMoneyScore ?? 0),
    )
    return buildOkMarketFeed(items, 'birdeye:trending+smartMoneyScore')
  })
}
