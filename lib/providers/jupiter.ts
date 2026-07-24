import 'server-only'

import { cachedJson } from '@/lib/cache/ttl'
import { getJupiterQuote } from '@/lib/trading/jupiter-client'
import type { TokenPrice } from '@/lib/providers/types'

export type { JupiterQuote, JupiterQuoteOptions } from '@/lib/trading/jupiter-client'

const TIMEOUT_MS = 8_000
const PRICE_TTL_SEC = 12

type V3Row = {
  usdPrice?: number
  price?: string | number
  priceChange24h?: number
}

function jupiterHeaders(): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const key = process.env.JUPITER_API_KEY?.trim()
  if (key) headers['x-api-key'] = key
  return headers
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      headers: jupiterHeaders(),
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Jupiter Price API v3 (api.jup.ag + lite-api fallback).
 * Returns empty Map on total failure — never fabricates prices.
 */
export async function fetchPrices(mints: string[]): Promise<Map<string, TokenPrice>> {
  const unique = [...new Set(mints.filter((m) => typeof m === 'string' && m.length >= 32))]
  if (!unique.length) return new Map()

  const cacheKey = `jup:price:v3:${unique.slice().sort().join(',')}`
  // ~12s cache — price hot path
  return cachedJson(cacheKey, PRICE_TTL_SEC, async () => {
    const out = new Map<string, TokenPrice>()
    const ids = unique.join(',')
    const urls = [
      `https://api.jup.ag/price/v3?ids=${encodeURIComponent(ids)}`,
      `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(ids)}`,
      `https://api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}`,
      `https://lite-api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}`,
    ]

    for (const url of urls) {
      const res = await fetchWithTimeout(url)
      if (!res?.ok) continue
      try {
        const rawBody = (await res.json()) as unknown
        const nested =
          rawBody &&
          typeof rawBody === 'object' &&
          'data' in rawBody &&
          (rawBody as { data?: unknown }).data &&
          typeof (rawBody as { data: unknown }).data === 'object'
            ? ((rawBody as { data: Record<string, V3Row> }).data)
            : null
        const data: Record<string, V3Row> =
          nested ?? (rawBody as Record<string, V3Row>)

        for (const mint of unique) {
          const row = data[mint]
          if (!row) continue
          const raw = row.usdPrice ?? row.price
          const price = typeof raw === 'number' ? raw : Number(raw)
          if (!Number.isFinite(price) || price <= 0) continue
          const chg =
            typeof row.priceChange24h === 'number' && Number.isFinite(row.priceChange24h)
              ? row.priceChange24h
              : null
          out.set(mint, { mint, priceUsd: price, change24hPct: chg })
        }
        if (out.size) return out
      } catch {
        /* try next host */
      }
    }
    return out
  })
}

/** Thin wrap — swap quotes stay in the trading layer. */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number,
  options?: Parameters<typeof getJupiterQuote>[4],
) {
  return getJupiterQuote(inputMint, outputMint, amountLamports, slippageBps, options)
}
