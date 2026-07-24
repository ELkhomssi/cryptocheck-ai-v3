import 'server-only'

import { cached } from './cache'
import { providerFetch, providerFetchJson } from '@/lib/providers/http'
import { chunkArray } from '@/lib/providers/quota'

export type JupiterPrice = {
  mint: string
  priceUsd: number
  change24hPct: number | null
}

type V3Row = {
  usdPrice?: number
  price?: string | number
  priceChange24h?: number
  decimals?: number
}

const MINT_BATCH = 50

/**
 * Jupiter Price API v3 — batched + quota-gated. Server-only.
 * https://developers.jup.ag/docs/price
 * `priceChange24h` is a percentage (e.g. 1.29 = +1.29%).
 */
export async function fetchJupiterPrices(mints: string[]): Promise<Map<string, JupiterPrice>> {
  const unique = [...new Set(mints.filter((m) => m.length >= 32))]
  const out = new Map<string, JupiterPrice>()
  if (!unique.length) return out

  const key = `jup:price:v3:${unique.slice().sort().join(',')}`
  return cached(key, 12_000, async () => {
    const headers: HeadersInit = { Accept: 'application/json' }
    const apiKey = process.env.JUPITER_API_KEY?.trim()
    if (apiKey) (headers as Record<string, string>)['x-api-key'] = apiKey

    for (const batch of chunkArray(unique, MINT_BATCH)) {
      const ids = batch.join(',')
      const urls = [
        `https://api.jup.ag/price/v3?ids=${encodeURIComponent(ids)}`,
        `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(ids)}`,
        `https://api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}`,
        `https://lite-api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}`,
      ]

      let gotBatch = false
      for (const url of urls) {
        const result = await providerFetch('jupiter', url, { headers, timeoutMs: 8_000 })
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
              ? ((rawBody as { data: Record<string, V3Row & { price?: string | number }> }).data)
              : null
          const data: Record<string, V3Row & { price?: string | number }> =
            nested ?? (rawBody as Record<string, V3Row & { price?: string | number }>)

          for (const mint of batch) {
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
          if ([...out.keys()].some((m) => batch.includes(m))) {
            gotBatch = true
            break
          }
        } catch {
          /* try next host */
        }
      }
      if (!gotBatch) break
    }

    await enrichChangeFromBirdeye(out, unique)
    return out
  })
}

async function enrichChangeFromBirdeye(
  prices: Map<string, JupiterPrice>,
  mints: string[],
): Promise<void> {
  const apiKey = process.env.BIRDEYE_API_KEY?.trim()
  if (!apiKey) return
  const need = mints.filter((m) => {
    const row = prices.get(m)
    return row && row.change24hPct == null
  })
  if (!need.length) return

  for (const mint of need.slice(0, 12)) {
    const body = await providerFetchJson<{
      data?: { value?: number; priceChange24h?: number; priceChange24hPercent?: number }
    }>(
      'birdeye',
      `https://public-api.birdeye.so/defi/price?address=${mint}&include_24hr_change=true`,
      {
        headers: { Accept: 'application/json', 'X-API-KEY': apiKey },
        timeoutMs: 8_000,
      },
    )
    if (!body) break
    const row = prices.get(mint)
    if (!row) continue
    const chg = body.data?.priceChange24hPercent ?? body.data?.priceChange24h
    if (typeof chg === 'number' && Number.isFinite(chg)) {
      prices.set(mint, { ...row, change24hPct: chg })
    }
  }
}
