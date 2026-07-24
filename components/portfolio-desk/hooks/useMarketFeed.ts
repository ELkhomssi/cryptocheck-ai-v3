'use client'

import { useQuery } from '@tanstack/react-query'
import type { ScreenerRow, TokenMarketMetrics } from '@/lib/providers/types'

export type MarketFeedKey =
  | 'gainers'
  | 'losers'
  | 'trending'
  | 'new-launches'
  | 'graduated'
  | 'volume'
  | 'smart-money'

export type MarketFeedPayload = {
  items: ScreenerRow[] | TokenMarketMetrics[]
  fetchedAt: string
  source: string
  error?: string
}

async function fetchMarketFeed(key: MarketFeedKey): Promise<MarketFeedPayload> {
  const res = await fetch(`/api/market/${key}`, { cache: 'no-store' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `Market feed ${key} unavailable`)
  }
  return (await res.json()) as MarketFeedPayload
}

export function useMarketFeed(key: MarketFeedKey) {
  return useQuery({
    queryKey: ['market-feed', key],
    queryFn: () => fetchMarketFeed(key),
    staleTime: 15_000,
    refetchInterval: 20_000,
  })
}
