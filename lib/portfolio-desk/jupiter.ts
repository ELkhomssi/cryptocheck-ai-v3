import 'server-only'

import { cached } from './cache'

export type JupiterPrice = {
  mint: string
  priceUsd: number
  change24hPct: number | null
}

/**
 * Jupiter Price API v2 — batched. Server-only.
 * https://station.jup.ag/docs/apis/price-api
 */
export async function fetchJupiterPrices(mints: string[]): Promise<Map<string, JupiterPrice>> {
  const unique = [...new Set(mints.filter((m) => m.length >= 32))]
  const out = new Map<string, JupiterPrice>()
  if (!unique.length) return out

  const key = `jup:price:${unique.slice().sort().join(',')}`
  return cached(key, 12_000, async () => {
    const ids = unique.join(',')
    const urls = [
      `https://api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}&showExtraInfo=true`,
      `https://lite-api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}&showExtraInfo=true`,
    ]
    const headers: HeadersInit = { Accept: 'application/json' }
    const apiKey = process.env.JUPITER_API_KEY?.trim()
    if (apiKey) (headers as Record<string, string>)['x-api-key'] = apiKey

    for (const url of urls) {
      try {
        const res = await fetch(url, { headers, cache: 'no-store' })
        if (!res.ok) continue
        const body = (await res.json()) as {
          data?: Record<
            string,
            {
              price?: string | number
              extraInfo?: {
                quotedPrice?: { buyPrice?: number; sellPrice?: number }
                lastSwappedPrice?: { lastJupiterSellAt?: number; lastJupiterSellPrice?: number }
                confidenceLevel?: string
                depth?: unknown
              }
            }
          >
        }
        for (const mint of unique) {
          const row = body.data?.[mint]
          const raw = row?.price
          const price = typeof raw === 'number' ? raw : Number(raw)
          if (!Number.isFinite(price) || price <= 0) continue
          // Jupiter v2 does not always return 24h change; leave null when absent.
          out.set(mint, { mint, priceUsd: price, change24hPct: null })
        }
        if (out.size) return out
      } catch {
        /* try next host */
      }
    }
    return out
  })
}
