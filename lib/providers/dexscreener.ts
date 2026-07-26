import 'server-only'

import { cachedJson } from '@/lib/cache/ttl'
import type { ScreenerRow, TokenMarketMetrics } from '@/lib/providers/types'
import { metricsToScreenerRow } from '@/lib/terminal/market-feed-helpers'

const TIMEOUT_MS = 8_000
const TTL_SEC = 20

type DexPair = {
  dexId?: string
  pairAddress?: string
  chainId?: string
  priceUsd?: string
  liquidity?: { usd?: number }
  volume?: { h24?: number; h1?: number; m5?: number }
  priceChange?: { h24?: number; h1?: number; m5?: number }
  fdv?: number
  marketCap?: number
  txns?: { h24?: { buys?: number; sells?: number } }
  info?: { imageUrl?: string }
  baseToken?: { address?: string; symbol?: string; name?: string }
  quoteToken?: { address?: string; symbol?: string; name?: string }
}

type DexBoostOrProfile = {
  chainId?: string
  tokenAddress?: string
  url?: string
  description?: string
  icon?: string
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function pickBestPair(pairs: DexPair[], preferMint?: string): DexPair | null {
  if (!pairs.length) return null
  const scoped = preferMint
    ? pairs.filter((p) => p.baseToken?.address === preferMint)
    : pairs
  const pool = scoped.length ? scoped : pairs
  return [...pool].sort((a, b) => {
    const liqA = typeof a.liquidity?.usd === 'number' ? a.liquidity.usd : 0
    const liqB = typeof b.liquidity?.usd === 'number' ? b.liquidity.usd : 0
    if (liqA !== liqB) return liqB - liqA
    const volA = typeof a.volume?.h24 === 'number' ? a.volume.h24 : 0
    const volB = typeof b.volume?.h24 === 'number' ? b.volume.h24 : 0
    return volB - volA
  })[0]
}

function pairToMetrics(mint: string, pair: DexPair): TokenMarketMetrics {
  const buys = pair.txns?.h24?.buys ?? 0
  const sells = pair.txns?.h24?.sells ?? 0
  const ratio = sells > 0 ? buys / sells : buys > 0 ? buys : 0
  return {
    mint,
    symbol: pair.baseToken?.symbol,
    name: pair.baseToken?.name,
    priceUsd: num(pair.priceUsd),
    change5mPct: num(pair.priceChange?.m5),
    change1hPct: num(pair.priceChange?.h1),
    change24hPct: num(pair.priceChange?.h24),
    volume24hUsd: num(pair.volume?.h24),
    liquidityUsd: num(pair.liquidity?.usd),
    marketCapUsd: num(pair.marketCap ?? pair.fdv),
    fdvUsd: num(pair.fdv),
    holders: 0,
    txCount24h: Math.max(0, Math.floor(buys + sells)),
    buySellRatio: ratio,
    logoUrl: pair.info?.imageUrl,
  }
}

/**
 * DexScreener fallback — raw pairs for a mint. Empty on failure.
 */
export async function fetchTokenPairs(mint: string): Promise<DexPair[]> {
  if (!mint || mint.length < 32) return []
  return cachedJson(`dex:pairs:${mint}`, TTL_SEC, async () => {
    const { providerFetchJson } = await import('@/lib/providers/http')
    const body = await providerFetchJson<{ pairs?: DexPair[] | null }>(
      'dexscreener',
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      { headers: { Accept: 'application/json' }, timeoutMs: TIMEOUT_MS },
    )
    if (!body) return []
    return Array.isArray(body.pairs) ? body.pairs : []
  })
}

/**
 * Map best DexScreener pair → TokenMarketMetrics. null when no pair.
 */
export async function fetchTokenMetricsFromDex(
  mint: string,
): Promise<TokenMarketMetrics | null> {
  const pairs = await fetchTokenPairs(mint)
  const best = pickBestPair(pairs, mint)
  if (!best) return null
  return pairToMetrics(mint, best)
}

async function fetchSolanaTokenAddresses(
  path: string,
  cacheKey: string,
  limit: number,
): Promise<string[]> {
  const lim = Math.min(Math.max(1, Math.floor(limit)), 40)
  return cachedJson(cacheKey, TTL_SEC, async () => {
    const { providerFetchJson } = await import('@/lib/providers/http')
    const body = await providerFetchJson<DexBoostOrProfile[] | { pairs?: DexPair[] }>(
      'dexscreener',
      `https://api.dexscreener.com${path}`,
      { headers: { Accept: 'application/json' }, timeoutMs: TIMEOUT_MS },
    )
    if (!body) return []
    const out: string[] = []
    const seen = new Set<string>()
    if (Array.isArray(body)) {
      for (const row of body) {
        if (row.chainId !== 'solana') continue
        const mint = row.tokenAddress
        if (!mint || mint.length < 32 || seen.has(mint)) continue
        seen.add(mint)
        out.push(mint)
        if (out.length >= lim) break
      }
      return out
    }
    return []
  })
}

/**
 * Live Solana mints from DexScreener boosts + latest profiles (public, no key).
 * Used when Birdeye screener corpus is empty — never fabricates metrics.
 */
export async function fetchDexScreenerSolanaMints(limit = 30): Promise<string[]> {
  const lim = Math.min(Math.max(1, Math.floor(limit)), 40)
  const [boosts, profiles] = await Promise.all([
    fetchSolanaTokenAddresses('/token-boosts/top/v1', 'dex:boosts:sol', lim),
    fetchSolanaTokenAddresses('/token-profiles/latest/v1', 'dex:profiles:sol', lim),
  ])
  const seen = new Set<string>()
  const out: string[] = []
  for (const mint of [...boosts, ...profiles]) {
    if (seen.has(mint)) continue
    seen.add(mint)
    out.push(mint)
    if (out.length >= lim) break
  }
  return out
}

/**
 * Enrich Solana DexScreener mints → ScreenerRow[] with real pair metrics.
 * ~50–150ms estimated per mint (capped concurrency via Promise.all on ≤limit).
 */
export async function fetchDexScreenerScreenerRows(limit = 30): Promise<ScreenerRow[]> {
  const mints = await fetchDexScreenerSolanaMints(limit)
  if (!mints.length) return []
  // Cap fan-out to protect DexScreener public rate limits (~50–150ms/mint estimated)
  const capped = mints.slice(0, Math.min(mints.length, 16))
  const rows = await Promise.all(
    capped.map(async (mint) => {
      const metrics = await fetchTokenMetricsFromDex(mint)
      if (!metrics) return null
      return metricsToScreenerRow(metrics, { isTrending: true })
    }),
  )
  return rows.filter((r): r is ScreenerRow => r != null)
}
