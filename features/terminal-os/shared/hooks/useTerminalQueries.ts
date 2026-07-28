'use client'

import { useQuery } from '@tanstack/react-query'
import {
  liveMarketDataProvider,
  liveTraderLeaderboardProvider,
  liveWhaleFeedProvider,
} from '@/features/terminal-os/shared/lib/live-providers'
import type { ChainId } from '@/features/terminal-os/shared/types'

const STALE_PRICE = 12_000
const STALE_SLOW = 60_000

export function useTickerQuotes() {
  return useQuery({
    queryKey: ['tos', 'ticker'],
    queryFn: () => liveMarketDataProvider.getTickerQuotes(),
    staleTime: STALE_PRICE,
    refetchInterval: STALE_PRICE,
  })
}

export function useTopTokens(chain: ChainId) {
  return useQuery({
    queryKey: ['tos', 'tokens', chain],
    queryFn: () => liveMarketDataProvider.getTopTokens(chain),
    staleTime: STALE_PRICE,
    refetchInterval: 20_000,
  })
}

export function useWhaleMovements(limit = 10) {
  return useQuery({
    queryKey: ['tos', 'whales', limit],
    queryFn: () => liveWhaleFeedProvider.getRecentMovements(limit),
    staleTime: 20_000,
    refetchInterval: 25_000,
  })
}

export function useTopTraders() {
  return useQuery({
    queryKey: ['tos', 'traders'],
    queryFn: () => liveTraderLeaderboardProvider.getTopTradersToday(),
    staleTime: STALE_PRICE,
    refetchInterval: 30_000,
  })
}

export function useChainSnapshots() {
  return useQuery({
    queryKey: ['tos', 'snapshots'],
    queryFn: () => liveMarketDataProvider.getChainSnapshots(),
    staleTime: STALE_SLOW,
    refetchInterval: STALE_SLOW,
  })
}

export function useMarketOverview() {
  return useQuery({
    queryKey: ['tos', 'overview'],
    queryFn: () => liveMarketDataProvider.getMarketOverview(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
