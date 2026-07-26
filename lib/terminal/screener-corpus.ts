import 'server-only'

/**
 * Multi-source screener corpus + sparse-row enrichment.
 * Primary: Birdeye. Fallbacks: DexScreener (live Solana), Raydium (new),
 * Jupiter (24h change / price), Helius DAS (name/symbol/logo).
 * Never fabricates — only merges real provider fields.
 */

import {
  fetchNewListings,
  fetchTokenList,
  fetchTrending,
} from '@/lib/providers/birdeye'
import {
  fetchDexScreenerScreenerRows,
  fetchTokenMetricsFromDex,
} from '@/lib/providers/dexscreener'
import { getAsset, heliusAssetMeta } from '@/lib/providers/helius'
import { fetchPrices } from '@/lib/providers/jupiter'
import { fetchNewPools } from '@/lib/providers/raydium'
import type { NewPool, ScreenerRow } from '@/lib/providers/types'
import {
  mergeNewPoolsByMint,
  metricsToScreenerRow,
  newPoolToScreenerRow,
} from '@/lib/terminal/market-feed-helpers'

export type ScreenerCorpus = {
  rows: ScreenerRow[]
  trending: ScreenerRow[]
  news: NewPool[]
  source: string
}

function mergeByMint(...lists: ScreenerRow[][]): ScreenerRow[] {
  const byMint = new Map<string, ScreenerRow>()
  for (const list of lists) {
    for (const row of list) {
      if (!row.mint) continue
      const prev = byMint.get(row.mint)
      if (!prev) {
        byMint.set(row.mint, row)
        continue
      }
      byMint.set(row.mint, {
        ...prev,
        mint: prev.mint,
        symbol: prev.symbol || row.symbol,
        name: prev.name || row.name,
        logoUrl: prev.logoUrl || row.logoUrl,
        priceUsd: prev.priceUsd || row.priceUsd,
        change5mPct: prev.change5mPct || row.change5mPct,
        change1hPct: prev.change1hPct || row.change1hPct,
        change24hPct: prev.change24hPct || row.change24hPct,
        volume24hUsd: Math.max(prev.volume24hUsd, row.volume24hUsd),
        liquidityUsd: Math.max(prev.liquidityUsd, row.liquidityUsd),
        marketCapUsd: prev.marketCapUsd || row.marketCapUsd,
        fdvUsd: prev.fdvUsd || row.fdvUsd,
        holders: Math.max(prev.holders, row.holders),
        txCount24h: Math.max(prev.txCount24h, row.txCount24h),
        buySellRatio: prev.buySellRatio || row.buySellRatio,
        isTrending: prev.isTrending || row.isTrending,
        isPumpFun: prev.isPumpFun || row.isPumpFun,
        isRaydium: prev.isRaydium || row.isRaydium,
        isGraduated: prev.isGraduated || row.isGraduated,
        isVerified: prev.isVerified || row.isVerified,
        smartMoneyScore: Math.max(prev.smartMoneyScore, row.smartMoneyScore),
        riskScore: prev.riskScore || row.riskScore,
        aiScore: prev.aiScore || row.aiScore,
      })
    }
  }
  return [...byMint.values()]
}

/**
 * Fill sparse change%/price from Jupiter; name/logo from Helius when missing.
 * Dex pair fill for rows that still lack volume+liquidity (capped).
 * ~40–200ms estimated (Jupiter batch + optional Helius/Dex fan-out).
 */
export async function enrichScreenerRows(
  rows: ScreenerRow[],
  opts: { dexFillLimit?: number; heliusFillLimit?: number } = {},
): Promise<ScreenerRow[]> {
  if (!rows.length) return rows
  const dexFillLimit = opts.dexFillLimit ?? 12
  const heliusFillLimit = opts.heliusFillLimit ?? 12

  const mints = rows.map((r) => r.mint)
  // ~40–120ms estimated
  const prices = await fetchPrices(mints)

  let next = rows.map((r) => {
    const p = prices.get(r.mint)
    if (!p) return r
    return {
      ...r,
      priceUsd: r.priceUsd > 0 ? r.priceUsd : p.priceUsd,
      change24hPct:
        r.change24hPct !== 0
          ? r.change24hPct
          : typeof p.change24hPct === 'number'
            ? p.change24hPct
            : r.change24hPct,
    }
  })

  const needMeta = next
    .filter((r) => !r.symbol || !r.name || !r.logoUrl)
    .slice(0, heliusFillLimit)
  if (needMeta.length) {
    // ~50–150ms estimated per mint (Helius DAS; capped)
    const metas = await Promise.all(
      needMeta.map(async (r) => {
        const asset = await getAsset(r.mint)
        return { mint: r.mint, meta: heliusAssetMeta(asset) }
      }),
    )
    const byMint = new Map(metas.map((m) => [m.mint, m.meta]))
    next = next.map((r) => {
      const meta = byMint.get(r.mint)
      if (!meta) return r
      return {
        ...r,
        symbol: r.symbol || meta.symbol,
        name: r.name || meta.name,
        logoUrl: r.logoUrl || meta.logoUrl,
        priceUsd: r.priceUsd > 0 ? r.priceUsd : meta.priceUsd ?? 0,
      }
    })
  }

  const needDex = next
    .filter((r) => r.volume24hUsd <= 0 && r.liquidityUsd <= 0)
    .slice(0, dexFillLimit)
  if (needDex.length) {
    // ~50–150ms estimated per mint (DexScreener; capped)
    const dexRows = await Promise.all(
      needDex.map(async (r) => {
        const m = await fetchTokenMetricsFromDex(r.mint)
        return m ? metricsToScreenerRow(m, { isTrending: r.isTrending }) : null
      }),
    )
    next = mergeByMint(
      next,
      dexRows.filter((r): r is ScreenerRow => r != null),
    )
  }

  return next
}

export type LoadScreenerCorpusParams = {
  sortBy: string
  sortType: 'asc' | 'desc'
  offset: number
  limit: number
  minLiquidity?: number
  wantTrending: boolean
  wantNew: boolean
  skipTokenList: boolean
}

/**
 * Load screener corpus with Birdeye primary + honest multi-source fallbacks.
 */
export async function loadScreenerCorpus(
  params: LoadScreenerCorpusParams,
): Promise<ScreenerCorpus> {
  const sources: string[] = []

  const [rawBird, trendingBird, newsBird, newsRay] = await Promise.all([
    params.skipTokenList
      ? Promise.resolve([] as ScreenerRow[])
      : fetchTokenList({
          sortBy: params.sortBy,
          sortType: params.sortType,
          offset: params.offset,
          limit: params.limit,
          minLiquidity: params.minLiquidity,
        }),
    // Always pull a small trending set for mint flagging when cached (~20s TTL).
    fetchTrending(params.wantTrending ? 20 : 8),
    params.wantNew
      ? fetchNewListings(50)
      : Promise.resolve([] as NewPool[]),
    params.wantNew
      ? fetchNewPools(40)
      : Promise.resolve([] as NewPool[]),
  ])

  if (rawBird.length) sources.push('birdeye')
  if (trendingBird.length) sources.push('birdeye-trending')

  let news = mergeNewPoolsByMint(newsBird, newsRay)
  if (newsBird.length) sources.push('birdeye-new')
  if (newsRay.length) sources.push('raydium')

  let rows = rawBird
  let trending = trendingBird.map((r) => ({ ...r, isTrending: true }))

  // Fallback corpus when Birdeye list is empty — DexScreener live Solana feeds
  if (!rows.length) {
    // ~200–800ms estimated (Dex boosts/profiles + pair enrichment)
    const dexRows = await fetchDexScreenerScreenerRows(Math.min(params.limit, 30))
    if (dexRows.length) {
      rows = dexRows
      sources.push('dexscreener')
      if (!trending.length) {
        trending = dexRows.map((r) => ({ ...r, isTrending: true }))
        sources.push('dexscreener-trending')
      }
    }
  }

  // Trending-only empty: reuse Dex boosts as trending markers
  if (params.wantTrending && !trending.length) {
    const dexRows = rows.length
      ? rows.slice(0, 20).map((r) => ({ ...r, isTrending: true }))
      : await fetchDexScreenerScreenerRows(20)
    if (dexRows.length) {
      trending = dexRows.map((r) => ({ ...r, isTrending: true }))
      if (!sources.includes('dexscreener-trending')) sources.push('dexscreener-trending')
      if (!rows.length) {
        rows = dexRows
        if (!sources.includes('dexscreener')) sources.push('dexscreener')
      }
    }
  }

  // New launches: if Birdeye+Raydium empty, seed from Dex latest profiles
  if (params.wantNew && !news.length) {
    const dexRows = await fetchDexScreenerScreenerRows(20)
    news = dexRows.map((r) => ({
      mint: r.mint,
      symbol: r.symbol ?? '',
      name: r.name ?? '',
      poolAddress: '',
      liquidityUsd: r.liquidityUsd,
      createdAt: 0, // unknown — do not fabricate listing time
      source: 'dexscreener',
    }))
    if (news.length) sources.push('dexscreener-new')
  }

  rows = await enrichScreenerRows(rows)
  trending = await enrichScreenerRows(trending, { dexFillLimit: 8, heliusFillLimit: 8 })

  return {
    rows,
    trending,
    news,
    source: sources.length ? sources.join('+') : 'unavailable',
  }
}

export function newsPoolsToScreenerRows(news: NewPool[]): ScreenerRow[] {
  return news.map((p) => newPoolToScreenerRow(p))
}
