'use client'

import { useQuery } from '@tanstack/react-query'
import type { IntelligenceChartBundle } from '../types'

async function fetchBundle(query: string, chain: string): Promise<IntelligenceChartBundle | null> {
  const params = new URLSearchParams({ query, chain })
  const res = await fetch(`/api/terminal-os/intelligence-chart?${params}`, { cache: 'no-store' })
  if (!res.ok) return null
  const body = (await res.json()) as { bundle: IntelligenceChartBundle | null }
  return body.bundle
}

export function useIntelligenceChart(query: string | null, chain: string) {
  return useQuery({
    queryKey: ['intelligence-chart', query, chain],
    queryFn: () => fetchBundle(query!, chain),
    enabled: Boolean(query && query.trim()),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
