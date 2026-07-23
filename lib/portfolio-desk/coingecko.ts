import 'server-only'

import { COINGECKO_IDS, RANGE_MS } from './constants'
import { cached } from './cache'

export type HistoryPoint = { t: number; price: number }

/**
 * CoinGecko market_chart — free tier is rate-limited; cache aggressively.
 * Birdeye can be wired later via BIRDEYE_API_KEY for Solana-only mints.
 */
export async function fetchPriceHistory(
  mint: string,
  range: keyof typeof RANGE_MS,
): Promise<HistoryPoint[]> {
  const cgId = COINGECKO_IDS[mint]
  if (!cgId) {
    // Birdeye fallback when configured
    const bird = process.env.BIRDEYE_API_KEY?.trim()
    if (bird) return fetchBirdeyeHistory(mint, range, bird)
    return []
  }

  const days =
    range === '24H' ? 1 : range === '7D' ? 7 : range === '30D' ? 30 : range === '90D' ? 90 : 365

  return cached(`cg:${cgId}:${days}`, 60_000, async () => {
    const url = `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`
    const headers: HeadersInit = { Accept: 'application/json' }
    const key = process.env.COINGECKO_API_KEY?.trim()
    if (key) (headers as Record<string, string>)['x-cg-demo-api-key'] = key
    try {
      const res = await fetch(url, { headers, next: { revalidate: 60 } })
      if (!res.ok) return []
      const body = (await res.json()) as { prices?: [number, number][] }
      return (body.prices ?? []).map(([t, price]) => ({ t, price }))
    } catch {
      return []
    }
  })
}

async function fetchBirdeyeHistory(
  mint: string,
  range: keyof typeof RANGE_MS,
  apiKey: string,
): Promise<HistoryPoint[]> {
  const now = Math.floor(Date.now() / 1000)
  const from = Math.floor((Date.now() - RANGE_MS[range]) / 1000)
  const type =
    range === '24H' ? '15m' : range === '7D' ? '1H' : range === '30D' ? '4H' : '1D'
  return cached(`birdeye:${mint}:${range}`, 60_000, async () => {
    try {
      const url = `https://public-api.birdeye.so/defi/history_price?address=${mint}&address_type=token&type=${type}&time_from=${from}&time_to=${now}`
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'X-API-KEY': apiKey },
        cache: 'no-store',
      })
      if (!res.ok) return []
      const body = (await res.json()) as {
        data?: { items?: Array<{ unixTime?: number; value?: number }> }
      }
      return (body.data?.items ?? [])
        .filter((i) => i.unixTime != null && i.value != null)
        .map((i) => ({ t: (i.unixTime as number) * 1000, price: i.value as number }))
    } catch {
      return []
    }
  })
}
