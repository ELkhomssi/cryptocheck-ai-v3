import 'server-only'

import { cachedJson } from '@/lib/cache/ttl'
import { providerFetch } from '@/lib/providers/http'
import { chunkArray } from '@/lib/providers/quota'
import { getJupiterQuote } from '@/lib/trading/jupiter-client'
import type { TokenPrice } from '@/lib/providers/types'

export type { JupiterQuote, JupiterQuoteOptions } from '@/lib/trading/jupiter-client'

const PRICE_TTL_SEC = 12
/** Jupiter price API accepts many ids; keep batches modest for URL length + quota. */
const MINT_BATCH = 50

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

async function fetchPriceBatch(mints: string[]): Promise<Map<string, TokenPrice>> {
  const out = new Map<string, TokenPrice>()
  if (!mints.length) return out
  const ids = mints.join(',')
  const urls = [
    `https://api.jup.ag/price/v3?ids=${encodeURIComponent(ids)}`,
    `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(ids)}`,
    `https://api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}`,
    `https://lite-api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}`,
  ]

  for (const url of urls) {
    const result = await providerFetch('jupiter', url, {
      headers: jupiterHeaders(),
      timeoutMs: 8_000,
    })
    if (result.ok === false) {
      if (result.reason === 'quota') return out
      continue
    }
    try {
      const rawBody = (await result.res.json()) as unknown
      const nested =
        rawBody &&
        typeof rawBody === 'object' &&
        'data' in rawBody &&
        (rawBody as { data?: unknown }).data &&
        typeof (rawBody as { data: unknown }).data === 'object'
          ? ((rawBody as { data: Record<string, V3Row> }).data)
          : null
      const data: Record<string, V3Row> = nested ?? (rawBody as Record<string, V3Row>)

      for (const mint of mints) {
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
}

/**
 * Jupiter Price API v3 (api.jup.ag + lite-api fallback).
 * Batches mints and quota-gates each upstream call.
 * Returns empty Map on total failure — never fabricates prices.
 */
export async function fetchPrices(mints: string[]): Promise<Map<string, TokenPrice>> {
  const unique = [...new Set(mints.filter((m) => typeof m === 'string' && m.length >= 32))]
  if (!unique.length) return new Map()

  const cacheKey = `jup:price:v3:${unique.slice().sort().join(',')}`
  return cachedJson(cacheKey, PRICE_TTL_SEC, async () => {
    const out = new Map<string, TokenPrice>()
    for (const batch of chunkArray(unique, MINT_BATCH)) {
      const part = await fetchPriceBatch(batch)
      for (const [k, v] of part) out.set(k, v)
      if (part.size === 0 && batch.length > 0) break
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
