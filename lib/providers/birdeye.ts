import 'server-only'

import { cachedJson } from '@/lib/cache/ttl'
import { providerFetchJson } from '@/lib/providers/http'
import {
  extractBirdeyeTokenRows,
  mapBirdeyeRowToMetrics,
  mapBirdeyeRowToScreener,
  SCREENER_SORT_TO_BIRDEYE_LEGACY,
  SCREENER_SORT_TO_BIRDEYE_V3,
} from '@/lib/providers/birdeye-map'
import type {
  NewPool,
  OhlcvPoint,
  ScreenerRow,
  TokenMarketMetrics,
} from '@/lib/providers/types'

const BASE = 'https://public-api.birdeye.so'
const CHAIN_HEADER = { 'x-chain': 'solana' } as const

const TTL = {
  trending: 20,
  overview: 15,
  ohlcv: 60,
  tokenList: 20,
  newListings: 20,
  priceChange: 15,
} as const

function apiKey(): string | null {
  const k = process.env.BIRDEYE_API_KEY?.trim()
  return k || null
}

function headers(): HeadersInit {
  const key = apiKey()
  const h: Record<string, string> = {
    Accept: 'application/json',
    ...CHAIN_HEADER,
  }
  if (key) h['X-API-KEY'] = key
  return h
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

async function birdeyeGet(pathAndQuery: string): Promise<unknown | null> {
  if (!apiKey()) return null
  return providerFetchJson('birdeye', `${BASE}${pathAndQuery}`, {
    headers: headers(),
    timeoutMs: 8_000,
  })
}

function mapRows(body: unknown, extras?: { isTrending?: boolean }): ScreenerRow[] {
  const out: ScreenerRow[] = []
  for (const row of extractBirdeyeTokenRows(body)) {
    const mapped = mapBirdeyeRowToScreener(row, extras)
    if (mapped) out.push(mapped)
  }
  return out
}

/** Token overview → TokenMarketMetrics. null when no key / failure. */
export async function fetchTokenOverview(mint: string): Promise<TokenMarketMetrics | null> {
  if (!mint || !apiKey()) return null
  return cachedJson(`birdeye:overview:${mint}`, TTL.overview, async () => {
    const body = await birdeyeGet(`/defi/token_overview?address=${encodeURIComponent(mint)}`)
    // overview returns a single object under data
    const d =
      body && typeof body === 'object' ? (body as { data?: unknown }).data : null
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null
    return mapBirdeyeRowToMetrics(mint, d as Record<string, unknown>)
  })
}

/** Alias for overview-shaped market metrics. */
export async function fetchTokenMarket(mint: string): Promise<TokenMarketMetrics | null> {
  return fetchTokenOverview(mint)
}

/** Trending tokens as ScreenerRow[]. Empty when no key / failure. */
export async function fetchTrending(limit = 20): Promise<ScreenerRow[]> {
  if (!apiKey()) return []
  const lim = Math.min(Math.max(1, Math.floor(limit)), 20)
  return cachedJson(`birdeye:trending:v2:${lim}`, TTL.trending, async () => {
    // Docs: sort_by = rank | liquidity | volume24hUSD. Try rank then volume.
    const attempts = [
      `/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=${lim}`,
      `/defi/token_trending?sort_by=volume24hUSD&sort_type=desc&offset=0&limit=${lim}`,
      `/defi/token_trending?sort_by=liquidity&sort_type=desc&offset=0&limit=${lim}`,
    ]
    for (const path of attempts) {
      const body = await birdeyeGet(path)
      const rows = mapRows(body, { isTrending: true })
      if (rows.length) return rows
    }
    return []
  })
}

export type TokenListParams = {
  sortBy?: string
  sortType?: 'asc' | 'desc'
  offset?: number
  limit?: number
  minLiquidity?: number
}

/**
 * Screener token list.
 * Prefers V3 `/defi/v3/token/list` (richer change%/mc/holders), falls back to legacy tokenlist.
 * Empty when no key / failure.
 */
export async function fetchTokenList(params: TokenListParams = {}): Promise<ScreenerRow[]> {
  if (!apiKey()) return []
  const sortByRaw = params.sortBy ?? 'v24hUSD'
  const sortType = params.sortType ?? 'desc'
  const offset = Math.max(0, Math.floor(params.offset ?? 0))
  const limit = Math.min(Math.max(1, Math.floor(params.limit ?? 50)), 50)
  const minLiq = params.minLiquidity

  // Accept screener keys (volume), legacy keys (v24hUSD), or V3 enums (volume_24h_usd).
  const v3Sort =
    SCREENER_SORT_TO_BIRDEYE_V3[sortByRaw] ??
    (sortByRaw.includes('_') ? sortByRaw : 'volume_24h_usd')
  const legacySort =
    SCREENER_SORT_TO_BIRDEYE_LEGACY[sortByRaw] ??
    (!sortByRaw.includes('_') ? sortByRaw : 'v24hUSD')

  const cacheKey = `birdeye:tokenlist:v3:${v3Sort}:${sortType}:${offset}:${limit}:${minLiq ?? ''}`
  return cachedJson(cacheKey, TTL.tokenList, async () => {
    const v3q = new URLSearchParams({
      sort_by: v3Sort,
      sort_type: sortType,
      offset: String(offset),
      limit: String(limit),
    })
    if (typeof minLiq === 'number' && Number.isFinite(minLiq)) {
      v3q.set('min_liquidity', String(minLiq))
    }

    const v3Body = await birdeyeGet(`/defi/v3/token/list?${v3q.toString()}`)
    const v3Rows = mapRows(v3Body)
    if (v3Rows.length) return v3Rows

    const legacyQ = new URLSearchParams({
      sort_by: legacySort,
      sort_type: sortType,
      offset: String(offset),
      limit: String(limit),
    })
    if (typeof minLiq === 'number' && Number.isFinite(minLiq)) {
      legacyQ.set('min_liquidity', String(minLiq))
    }
    const legacyBody = await birdeyeGet(`/defi/tokenlist?${legacyQ.toString()}`)
    return mapRows(legacyBody)
  })
}

/** OHLCV candles. Empty when no key / failure. */
export async function fetchOhlcv(
  mint: string,
  type: string,
  time_from: number,
  time_to: number,
): Promise<OhlcvPoint[]> {
  if (!mint || !apiKey()) return []
  const q = new URLSearchParams({
    address: mint,
    type,
    time_from: String(Math.floor(time_from)),
    time_to: String(Math.floor(time_to)),
  })
  return cachedJson(`birdeye:ohlcv:${q.toString()}`, TTL.ohlcv, async () => {
    const body = (await birdeyeGet(`/defi/ohlcv?${q.toString()}`)) as {
      data?: { items?: Array<Record<string, unknown>> }
    } | null
    const items = body?.data?.items
    if (!Array.isArray(items)) return []
    const out: OhlcvPoint[] = []
    for (const row of items) {
      const t = num(row.unixTime ?? row.t)
      const o = num(row.o ?? row.open)
      const h = num(row.h ?? row.high)
      const l = num(row.l ?? row.low)
      const c = num(row.c ?? row.close)
      const v = num(row.v ?? row.volume)
      if (!(t > 0)) continue
      out.push({ t, o, h, l, c, v })
    }
    return out
  })
}

/** New token listings as NewPool[]. Empty when no key / failure. */
export async function fetchNewListings(limit = 20): Promise<NewPool[]> {
  if (!apiKey()) return []
  const lim = Math.min(Math.max(1, Math.floor(limit)), 50)
  return cachedJson(`birdeye:new:v2:${lim}`, TTL.newListings, async () => {
    const attempts = [
      `/defi/v2/tokens/new_listing?limit=${lim}&meme_platform_enabled=true`,
      `/defi/v2/tokens/new_listing?limit=${lim}`,
      `/defi/token_new_listing?limit=${lim}`,
      // V3 recent listing sort as last resort corpus of “fresh” tokens
      `/defi/v3/token/list?sort_by=recent_listing_time&sort_type=desc&offset=0&limit=${lim}`,
    ]

    for (const path of attempts) {
      const body = await birdeyeGet(path)
      const rows = extractBirdeyeTokenRows(body)
      if (!rows.length) continue

      const out: NewPool[] = []
      for (const row of rows) {
        const mint =
          (typeof row.address === 'string' && row.address) ||
          (typeof row.mint === 'string' && row.mint) ||
          ''
        if (!mint) continue
        out.push({
          mint,
          symbol: typeof row.symbol === 'string' ? row.symbol : typeof row.symbols === 'string' ? row.symbols : '',
          name: typeof row.name === 'string' ? row.name : '',
          poolAddress:
            (typeof row.liquidityPool === 'string' && row.liquidityPool) ||
            (typeof row.poolAddress === 'string' && row.poolAddress) ||
            '',
          liquidityUsd: num(row.liquidity),
          createdAt: Math.floor(
            num(
              row.liquidityAddedAt ??
                row.createdAt ??
                row.openTime ??
                row.recent_listing_time ??
                row.listingTime,
            ),
          ),
          source: 'birdeye',
        })
      }
      if (out.length) return out
    }
    return []
  })
}

export type PriceChangeWindows = {
  mint: string
  change5mPct: number | null
  change1hPct: number | null
  change24hPct: number | null
}

/** 5m / 1h / 24h price change. null windows when unavailable. */
export async function fetchPriceChange(mint: string): Promise<PriceChangeWindows | null> {
  if (!mint || !apiKey()) return null
  return cachedJson(`birdeye:pchg:${mint}`, TTL.priceChange, async () => {
    const overview = await fetchTokenOverview(mint)
    if (!overview) return null
    const asPct = (v: number): number | null => (Number.isFinite(v) ? v : null)
    return {
      mint,
      change5mPct: asPct(overview.change5mPct),
      change1hPct: asPct(overview.change1hPct),
      change24hPct: asPct(overview.change24hPct),
    }
  })
}

export { SCREENER_SORT_TO_BIRDEYE_LEGACY, SCREENER_SORT_TO_BIRDEYE_V3 }
