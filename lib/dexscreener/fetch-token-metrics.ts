import 'server-only'

import { Redis } from '@upstash/redis'

type DexPair = {
  dexId?: string
  pairAddress?: string
  priceUsd?: string
  liquidity?: { usd?: number }
  volume?: { h24?: number }
  priceChange?: { h24?: number }
  pairCreatedAt?: number
  fdv?: number
  marketCap?: number
  baseToken?: { symbol?: string; name?: string }
}

type DexResponse = {
  pairs?: DexPair[] | null
}

export type TokenMetrics = {
  priceUsd?: number
  marketCapUsd?: number
  volume24hUsd?: number
  liquidityUsd?: number
  priceChange24h?: number
}

export type TokenMetricsWithPair = TokenMetrics & {
  pair: DexPair | null
}

const CACHE_PREFIX = 'dex:'
const CACHE_TTL_SECONDS = 60

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  return Redis.fromEnv()
}

function pickBestPair(pairs: DexPair[]): DexPair | null {
  if (!pairs.length) return null
  return [...pairs].sort((a, b) => {
    const liqA = typeof a.liquidity?.usd === 'number' ? a.liquidity.usd : 0
    const liqB = typeof b.liquidity?.usd === 'number' ? b.liquidity.usd : 0
    if (liqA !== liqB) return liqB - liqA
    const volA = typeof a.volume?.h24 === 'number' ? a.volume.h24 : 0
    const volB = typeof b.volume?.h24 === 'number' ? b.volume.h24 : 0
    return volB - volA
  })[0]
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function mapPairToMetrics(pair: DexPair | null): TokenMetricsWithPair {
  if (!pair) return { pair: null }
  const priceUsd = toNumber(pair.priceUsd)
  const marketCapDirect = toNumber(pair.marketCap)
  const fdv = toNumber(pair.fdv)
  return {
    pair,
    priceUsd,
    marketCapUsd: marketCapDirect ?? fdv,
    volume24hUsd: toNumber(pair.volume?.h24),
    liquidityUsd: toNumber(pair.liquidity?.usd),
    priceChange24h: toNumber(pair.priceChange?.h24),
  }
}

export async function fetchTokenMetricsWithPair(mint: string): Promise<TokenMetricsWithPair> {
  const key = `${CACHE_PREFIX}${mint}`
  const redis = getRedis()
  if (redis) {
    try {
      const cached = await redis.get<TokenMetricsWithPair>(key)
      if (cached && typeof cached === 'object') return cached
    } catch {
      // best-effort cache
    }
  }

  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
    cache: 'no-store',
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    if (res.status === 404) return { pair: null }
    throw new Error(`DexScreener HTTP ${res.status}`)
  }

  const body = (await res.json()) as DexResponse
  const pairs = Array.isArray(body.pairs) ? body.pairs : []
  const mapped = mapPairToMetrics(pickBestPair(pairs))

  if (redis) {
    try {
      await redis.set(key, mapped, { ex: CACHE_TTL_SECONDS })
    } catch {
      // best-effort cache
    }
  }

  return mapped
}

export async function fetchTokenMetrics(mint: string): Promise<TokenMetrics> {
  const result = await fetchTokenMetricsWithPair(mint)
  return {
    priceUsd: result.priceUsd,
    marketCapUsd: result.marketCapUsd,
    volume24hUsd: result.volume24hUsd,
    liquidityUsd: result.liquidityUsd,
    priceChange24h: result.priceChange24h,
  }
}
