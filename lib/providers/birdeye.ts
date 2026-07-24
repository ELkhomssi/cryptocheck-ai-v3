import 'server-only'

import { cachedJson } from '@/lib/cache/ttl'
import { providerFetchJson } from '@/lib/providers/http'
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

function buySellRatio(buy: unknown, sell: unknown): number {
  const b = num(buy)
  const s = num(sell)
  if (s <= 0) return b > 0 ? b : 0
  return b / s
}

function mapOverviewToMetrics(mint: string, d: Record<string, unknown>): TokenMarketMetrics {
  return {
    mint,
    symbol: typeof d.symbol === 'string' ? d.symbol : undefined,
    name: typeof d.name === 'string' ? d.name : undefined,
    priceUsd: num(d.price),
    change5mPct: num(d.priceChange5mPercent),
    change1hPct: num(d.priceChange1hPercent),
    change24hPct: num(d.priceChange24hPercent),
    volume24hUsd: num(d.v24hUSD ?? d.volume24hUSD),
    liquidityUsd: num(d.liquidity),
    marketCapUsd: num(d.marketCap),
    fdvUsd: num(d.fdv),
    holders: Math.max(0, Math.floor(num(d.holder))),
    txCount24h: Math.max(0, Math.floor(num(d.trade24h))),
    buySellRatio: buySellRatio(d.buy24h, d.sell24h),
    logoUrl: typeof d.logoURI === 'string' ? d.logoURI : undefined,
  }
}

function mapListRowToScreener(row: Record<string, unknown>): ScreenerRow | null {
  const mint =
    (typeof row.address === 'string' && row.address) ||
    (typeof row.mint === 'string' && row.mint) ||
    ''
  if (!mint) return null
  const base = mapOverviewToMetrics(mint, row)
  return {
    ...base,
    // Scoring fields filled by downstream layers — unset defaults, not fabricated scores
    riskScore: 0,
    aiScore: 0,
    isPumpFun: Boolean(row.isPumpFun ?? row.is_pump_fun),
    isRaydium: Boolean(row.isRaydium ?? row.is_raydium),
    isGraduated: Boolean(row.isGraduated ?? row.is_graduated),
    isVerified: Boolean(row.isVerified ?? row.verified),
    isTrending: Boolean(row.isTrending),
    // Only map real Birdeye smart-money fields — never invent whale wallets / scores
    smartMoneyScore: num(
      row.smartMoneyScore ?? row.smart_money_score ?? row.smartMoney ?? row.smart_money,
    ),
  }
}

/** Token overview → TokenMarketMetrics. null when no key / failure. */
export async function fetchTokenOverview(mint: string): Promise<TokenMarketMetrics | null> {
  if (!mint || !apiKey()) return null
  return cachedJson(`birdeye:overview:${mint}`, TTL.overview, async () => {
    const body = (await birdeyeGet(
      `/defi/token_overview?address=${encodeURIComponent(mint)}`,
    )) as { data?: Record<string, unknown> } | null
    if (!body?.data || typeof body.data !== 'object') return null
    return mapOverviewToMetrics(mint, body.data)
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
  return cachedJson(`birdeye:trending:${lim}`, TTL.trending, async () => {
    const body = (await birdeyeGet(
      `/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=${lim}`,
    )) as { data?: { tokens?: Record<string, unknown>[] } } | null
    const tokens = body?.data?.tokens
    if (!Array.isArray(tokens)) return []
    const out: ScreenerRow[] = []
    for (const row of tokens) {
      if (!row || typeof row !== 'object') continue
      const mapped = mapListRowToScreener({ ...row, isTrending: true })
      if (mapped) out.push(mapped)
    }
    return out
  })
}

export type TokenListParams = {
  sortBy?: string
  sortType?: 'asc' | 'desc'
  offset?: number
  limit?: number
  minLiquidity?: number
}

/** Screener token list. Empty when no key / failure. */
export async function fetchTokenList(params: TokenListParams = {}): Promise<ScreenerRow[]> {
  if (!apiKey()) return []
  const sortBy = params.sortBy ?? 'v24hUSD'
  const sortType = params.sortType ?? 'desc'
  const offset = Math.max(0, Math.floor(params.offset ?? 0))
  const limit = Math.min(Math.max(1, Math.floor(params.limit ?? 50)), 50)
  const minLiq = params.minLiquidity

  const q = new URLSearchParams({
    sort_by: sortBy,
    sort_type: sortType,
    offset: String(offset),
    limit: String(limit),
  })
  if (typeof minLiq === 'number' && Number.isFinite(minLiq)) {
    q.set('min_liquidity', String(minLiq))
  }

  return cachedJson(`birdeye:tokenlist:${q.toString()}`, TTL.tokenList, async () => {
    const body = (await birdeyeGet(`/defi/tokenlist?${q.toString()}`)) as {
      data?: { tokens?: Record<string, unknown>[] }
    } | null
    const tokens = body?.data?.tokens
    if (!Array.isArray(tokens)) return []
    const out: ScreenerRow[] = []
    for (const row of tokens) {
      if (!row || typeof row !== 'object') continue
      const mapped = mapListRowToScreener(row)
      if (mapped) out.push(mapped)
    }
    return out
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
  return cachedJson(`birdeye:new:${lim}`, TTL.newListings, async () => {
    const body = (await birdeyeGet(
      `/defi/v2/tokens/new_listing?limit=${lim}&meme_platform_enabled=true`,
    )) as { data?: { items?: Record<string, unknown>[] } | Record<string, unknown>[] } | null

    let items: Record<string, unknown>[] = []
    if (Array.isArray(body?.data)) {
      items = body.data as Record<string, unknown>[]
    } else if (body?.data && typeof body.data === 'object' && Array.isArray(body.data.items)) {
      items = body.data.items
    }
    if (!items.length) {
      // Legacy path
      const legacy = (await birdeyeGet(
        `/defi/token_new_listing?limit=${lim}`,
      )) as { data?: { items?: Record<string, unknown>[] } | Record<string, unknown>[] } | null
      if (Array.isArray(legacy?.data)) {
        items = legacy.data as Record<string, unknown>[]
      } else if (
        legacy?.data &&
        typeof legacy.data === 'object' &&
        Array.isArray((legacy.data as { items?: unknown }).items)
      ) {
        items = (legacy.data as { items: Record<string, unknown>[] }).items
      }
    }

    const out: NewPool[] = []
    for (const row of items) {
      const mint =
        (typeof row.address === 'string' && row.address) ||
        (typeof row.mint === 'string' && row.mint) ||
        ''
      if (!mint) continue
      out.push({
        mint,
        symbol: typeof row.symbol === 'string' ? row.symbol : '',
        name: typeof row.name === 'string' ? row.name : '',
        poolAddress:
          (typeof row.liquidityPool === 'string' && row.liquidityPool) ||
          (typeof row.poolAddress === 'string' && row.poolAddress) ||
          '',
        liquidityUsd: num(row.liquidity),
        createdAt: Math.floor(num(row.liquidityAddedAt ?? row.createdAt ?? row.openTime)),
        source: 'birdeye',
      })
    }
    return out
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
    const body = (await birdeyeGet(
      `/defi/token_overview?address=${encodeURIComponent(mint)}`,
    )) as { data?: Record<string, unknown> } | null
    const d = body?.data
    if (!d) return null
    const asPct = (v: unknown): number | null => {
      if (typeof v === 'number' && Number.isFinite(v)) return v
      return null
    }
    return {
      mint,
      change5mPct: asPct(d.priceChange5mPercent),
      change1hPct: asPct(d.priceChange1hPercent),
      change24hPct: asPct(d.priceChange24hPercent),
    }
  })
}
