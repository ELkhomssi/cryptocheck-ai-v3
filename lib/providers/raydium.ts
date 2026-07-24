import 'server-only'

import { cachedJson } from '@/lib/cache/ttl'
import type { NewPool } from '@/lib/providers/types'

const BASE = 'https://api-v3.raydium.io'
const TIMEOUT_MS = 8_000
const TTL_SEC = 30
const WSOL = 'So11111111111111111111111111111111111111112'

type RaydiumPool = {
  id?: string
  mintA?: { address?: string; symbol?: string; name?: string }
  mintB?: { address?: string; symbol?: string; name?: string }
  tvl?: number
  openTime?: string | number
  type?: string
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

async function raydiumGet(pathAndQuery: string): Promise<unknown | null> {
  const { providerFetchJson } = await import('@/lib/providers/http')
  return providerFetchJson('raydium', `${BASE}${pathAndQuery}`, {
    headers: { Accept: 'application/json' },
    timeoutMs: TIMEOUT_MS,
  })
}

function pickNonSolMint(p: RaydiumPool): {
  mint: string
  symbol: string
  name: string
} | null {
  const a = p.mintA
  const b = p.mintB
  if (a?.address && a.address !== WSOL) {
    return {
      mint: a.address,
      symbol: a.symbol ?? '',
      name: a.name ?? a.symbol ?? '',
    }
  }
  if (b?.address && b.address !== WSOL) {
    return {
      mint: b.address,
      symbol: b.symbol ?? '',
      name: b.name ?? b.symbol ?? '',
    }
  }
  if (a?.address) {
    return {
      mint: a.address,
      symbol: a.symbol ?? '',
      name: a.name ?? a.symbol ?? '',
    }
  }
  return null
}

function toNewPool(p: RaydiumPool): NewPool | null {
  if (!p.id) return null
  const token = pickNonSolMint(p)
  if (!token) return null
  const open = num(p.openTime)
  return {
    mint: token.mint,
    symbol: token.symbol,
    name: token.name,
    poolAddress: p.id,
    liquidityUsd: num(p.tvl),
    createdAt: open > 1e12 ? Math.floor(open / 1000) : Math.floor(open),
    source: 'raydium',
  }
}

/**
 * Best-effort new / recent Raydium pools.
 * Uses public list sorted by liquidity (API has no dedicated "new" sort) — empty on failure.
 */
export async function fetchNewPools(limit = 20): Promise<NewPool[]> {
  const lim = Math.min(Math.max(1, Math.floor(limit)), 100)
  return cachedJson(`raydium:new:${lim}`, TTL_SEC, async () => {
    const body = (await raydiumGet(
      `/pools/info/list?poolType=all&poolSortField=liquidity&sortType=desc&pageSize=${lim}&page=1`,
    )) as { data?: { data?: RaydiumPool[] } | RaydiumPool[] } | null

    let pools: RaydiumPool[] = []
    if (Array.isArray(body?.data)) {
      pools = body.data
    } else if (body?.data && typeof body.data === 'object' && Array.isArray(body.data.data)) {
      pools = body.data.data
    }
    if (!pools.length) return []

    const mapped = pools
      .map(toNewPool)
      .filter((p): p is NewPool => p != null)
      .sort((a, b) => b.createdAt - a.createdAt)
    return mapped.slice(0, lim)
  })
}

/**
 * Best pool for a mint (highest TVL). null on failure / not found.
 */
export async function fetchPoolByMint(mint: string): Promise<NewPool | null> {
  if (!mint || mint.length < 32) return null
  return cachedJson(`raydium:mint:${mint}`, TTL_SEC, async () => {
    const q = new URLSearchParams({
      mint1: mint,
      poolType: 'all',
      poolSortField: 'liquidity',
      sortType: 'desc',
      pageSize: '5',
      page: '1',
    })
    const body = (await raydiumGet(`/pools/info/mint?${q.toString()}`)) as {
      data?: { data?: RaydiumPool[] } | RaydiumPool[]
    } | null

    let pools: RaydiumPool[] = []
    if (Array.isArray(body?.data)) {
      pools = body.data
    } else if (body?.data && typeof body.data === 'object' && Array.isArray(body.data.data)) {
      pools = body.data.data
    }
    if (!pools.length) return null
    return toNewPool(pools[0])
  })
}
