import 'server-only'

import { cached } from './cache'

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

/**
 * Jupiter Price API v3 — batched. Server-only.
 * https://developers.jup.ag/docs/price
 * `priceChange24h` is a percentage (e.g. 1.29 = +1.29%).
 */
export async function fetchJupiterPrices(mints: string[]): Promise<Map<string, JupiterPrice>> {
  const unique = [...new Set(mints.filter((m) => m.length >= 32))]
  const out = new Map<string, JupiterPrice>()
  if (!unique.length) return out

  const key = `jup:price:v3:${unique.slice().sort().join(',')}`
  return cached(key, 12_000, async () => {
    const ids = unique.join(',')
    const urls = [
      `https://api.jup.ag/price/v3?ids=${encodeURIComponent(ids)}`,
      `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(ids)}`,
      // Legacy v2 fallback if v3 hosts reject the request
      `https://api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}`,
      `https://lite-api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}`,
    ]
    const headers: HeadersInit = { Accept: 'application/json' }
    const apiKey = process.env.JUPITER_API_KEY?.trim()
    if (apiKey) (headers as Record<string, string>)['x-api-key'] = apiKey

    for (const url of urls) {
      try {
        const res = await fetch(url, { headers, cache: 'no-store' })
        if (!res.ok) continue
        const rawBody = (await res.json()) as unknown
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
        if (out.size) {
          await enrichChangeFromBirdeye(out, unique)
          return out
        }
      } catch {
        /* try next host */
      }
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

  await Promise.all(
    need.slice(0, 12).map(async (mint) => {
      try {
        const url = `https://public-api.birdeye.so/defi/price?address=${mint}&include_24hr_change=true`
        const res = await fetch(url, {
          headers: { Accept: 'application/json', 'X-API-KEY': apiKey },
          cache: 'no-store',
        })
        if (!res.ok) return
        const body = (await res.json()) as {
          data?: { value?: number; priceChange24h?: number; priceChange24hPercent?: number }
        }
        const row = prices.get(mint)
        if (!row) return
        const chg = body.data?.priceChange24hPercent ?? body.data?.priceChange24h
        if (typeof chg === 'number' && Number.isFinite(chg)) {
          prices.set(mint, { ...row, change24hPct: chg })
        }
      } catch {
        /* ignore per-mint failures */
      }
    }),
  )
}
