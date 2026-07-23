'use client'

import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import type { HoldingsResponse } from '@/types/portfolio-desk'

async function fetchHoldings(wallet: string): Promise<HoldingsResponse> {
  const res = await fetch(`/api/portfolio/holdings?wallet=${encodeURIComponent(wallet)}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || 'Holdings unavailable')
  }
  return (await res.json()) as HoldingsResponse
}

export function useHoldings() {
  const { walletAddress, isConnected } = useSolana()
  return useQuery({
    queryKey: ['portfolio-holdings', walletAddress],
    queryFn: () => fetchHoldings(walletAddress!),
    enabled: Boolean(isConnected && walletAddress),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
