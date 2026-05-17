import 'server-only'

import { fetchTokenMetricsWithPair } from '@/lib/dexscreener/fetch-token-metrics'
import { fetchSolUsdPrice } from '@/lib/web4-terminal/market-service'

export type Web4OhlcvCandle = {
  o: number
  h: number
  l: number
  c: number
  t: number
}

export type Web4Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W'

const TIMEFRAME_MAP: Record<Web4Timeframe, { period: string; aggregate: number; birdeye: string }> = {
  '1m': { period: 'minute', aggregate: 1, birdeye: '1m' },
  '5m': { period: 'minute', aggregate: 5, birdeye: '5m' },
  '15m': { period: 'minute', aggregate: 15, birdeye: '15m' },
  '1H': { period: 'hour', aggregate: 1, birdeye: '1H' },
  '4H': { period: 'hour', aggregate: 4, birdeye: '4H' },
  '1D': { period: 'day', aggregate: 1, birdeye: '1D' },
  '1W': { period: 'day', aggregate: 7, birdeye: '1W' },
}

type GeckoOhlcvResponse = {
  data?: {
    attributes?: {
      ohlcv_list?: number[][]
    }
  }
}

type GeckoPoolsResponse = {
  data?: Array<{ attributes?: { address?: string } }>
}

async function resolvePoolAddress(mint: string): Promise<string | null> {
  const metrics = await fetchTokenMetricsWithPair(mint)
  const fromDex = metrics.pair?.pairAddress
  if (typeof fromDex === 'string' && fromDex.length > 20) return fromDex

  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${encodeURIComponent(mint)}/pools?page=1`,
      { next: { revalidate: 120 } },
    )
    if (!res.ok) return null
    const body = (await res.json()) as GeckoPoolsResponse
    const addr = body.data?.[0]?.attributes?.address
    return typeof addr === 'string' ? addr : null
  } catch {
    return null
  }
}

async function fetchGeckoOhlcv(
  poolAddress: string,
  timeframe: Web4Timeframe,
  solUsd: number,
): Promise<Web4OhlcvCandle[]> {
  const cfg = TIMEFRAME_MAP[timeframe] ?? TIMEFRAME_MAP['5m']
  const url = new URL(
    `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/${cfg.period}`,
  )
  url.searchParams.set('aggregate', String(cfg.aggregate))
  url.searchParams.set('limit', '80')
  url.searchParams.set('currency', 'usd')

  const res = await fetch(url.toString(), { next: { revalidate: 45 } })
  if (!res.ok) throw new Error(`GeckoTerminal OHLCV ${res.status}`)

  const body = (await res.json()) as GeckoOhlcvResponse
  const list = body.data?.attributes?.ohlcv_list ?? []
  if (!list.length) return []

  return list
    .filter((row) => Array.isArray(row) && row.length >= 5)
    .map((row) => {
      const usdOpen = row[1]
      const usdHigh = row[2]
      const usdLow = row[3]
      const usdClose = row[4]
      const div = solUsd > 0 ? solUsd : 1
      return {
        t: row[0],
        o: usdOpen / div,
        h: usdHigh / div,
        l: usdLow / div,
        c: usdClose / div,
      }
    })
}

async function fetchBirdeyeOhlcv(
  mint: string,
  timeframe: Web4Timeframe,
  solUsd: number,
): Promise<Web4OhlcvCandle[] | null> {
  const key = process.env.BIRDEYE_API_KEY?.trim()
  if (!key) return null

  const cfg = TIMEFRAME_MAP[timeframe] ?? TIMEFRAME_MAP['5m']
  const timeTo = Math.floor(Date.now() / 1000)
  const timeFrom = timeTo - 60 * 60 * 48

  const url = new URL('https://public-api.birdeye.so/defi/ohlcv')
  url.searchParams.set('address', mint)
  url.searchParams.set('type', cfg.birdeye)
  url.searchParams.set('currency', 'usd')
  url.searchParams.set('time_from', String(timeFrom))
  url.searchParams.set('time_to', String(timeTo))

  const res = await fetch(url.toString(), {
    headers: {
      'X-API-KEY': key,
      'x-chain': 'solana',
      Accept: 'application/json',
    },
    next: { revalidate: 45 },
  })
  if (!res.ok) return null

  const body = (await res.json()) as {
    data?: { items?: Array<{ unixTime: number; o: number; h: number; l: number; c: number }> }
  }
  const items = body.data?.items ?? []
  if (!items.length) return null

  const div = solUsd > 0 ? solUsd : 1
  return items.map((item) => ({
    t: item.unixTime,
    o: item.o / div,
    h: item.h / div,
    l: item.l / div,
    c: item.c / div,
  }))
}

export async function getWeb4Ohlcv(
  mint: string,
  timeframe: Web4Timeframe,
): Promise<{ candles: Web4OhlcvCandle[]; source: string; solUsd: number }> {
  const normalized = mint.trim()
  const solUsd = await fetchSolUsdPrice()

  const birdeye = await fetchBirdeyeOhlcv(normalized, timeframe, solUsd)
  if (birdeye?.length) {
    return { candles: birdeye.slice(-80), source: 'birdeye', solUsd }
  }

  const pool = await resolvePoolAddress(normalized)
  if (pool) {
    const gecko = await fetchGeckoOhlcv(pool, timeframe, solUsd)
    if (gecko.length) {
      return { candles: gecko.slice(-80), source: 'geckoterminal', solUsd }
    }
  }

  return { candles: [], source: 'unavailable', solUsd }
}
