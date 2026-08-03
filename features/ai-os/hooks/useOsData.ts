'use client'

/**
 * Portfolio + mission + modules for the AI OS shell.
 * Presentation hooks only — no fabricated figures.
 */

import { useQuery } from '@tanstack/react-query'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { summaryFromHoldings } from '@/features/terminal-os/portfolio-os/lib/summary-from-holdings'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import type { MissionViewModel, TimelineEvent } from '@/types/intelligence-core'
import type { ModuleCardView } from '@/types/intelligence'
import type { PortfolioHealthSummary } from '@/features/terminal-os/shared/types'

export function useOsPortfolio() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const connected = useTerminalOsStore((s) => s.walletConnected)

  const q = useQuery({
    queryKey: ['aios-portfolio', wallet],
    enabled: Boolean(wallet && connected),
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/holdings?wallet=${encodeURIComponent(wallet!)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Holdings unavailable')
      return (await res.json()) as HoldingsResponse
    },
    refetchInterval: 20_000,
    staleTime: 8_000,
  })

  const summary: PortfolioHealthSummary | null = q.data ? summaryFromHoldings(q.data) : null
  const worst =
    q.data?.holdings
      ?.filter((h) => h.mint !== 'So11111111111111111111111111111111111111112')
      .slice()
      .sort((a, b) => (a.change24hPct ?? 0) - (b.change24hPct ?? 0))[0] ?? null

  return {
    connected,
    wallet,
    holdings: q.data,
    summary,
    worst,
    loading: q.isLoading && !q.data,
    error: q.error ? 'Portfolio unavailable' : null,
  }
}

export function useOsMission() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)

  const missionQ = useQuery({
    queryKey: ['aios-mission', wallet],
    queryFn: async () => {
      const q = wallet ? `?wallet=${encodeURIComponent(wallet)}` : ''
      const res = await fetch(`/api/intelligence-core/mission${q}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Mission unavailable')
      return (await res.json()) as MissionViewModel
    },
    refetchInterval: 12_000,
    staleTime: 4_000,
  })

  const timelineQ = useQuery({
    queryKey: ['aios-timeline'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence-core/timeline?limit=48', { cache: 'no-store' })
      if (!res.ok) return [] as TimelineEvent[]
      const body = (await res.json()) as { events?: TimelineEvent[] }
      return body.events ?? []
    },
    refetchInterval: 8_000,
    staleTime: 3_000,
  })

  const modulesQ = useQuery({
    queryKey: ['aios-modules'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence/modules', { cache: 'no-store' })
      if (!res.ok) throw new Error('Modules unavailable')
      return (await res.json()) as {
        modules: ModuleCardView[]
        overallHealth: { score: number | null; calibrating: boolean }
      }
    },
    refetchInterval: 20_000,
    staleTime: 8_000,
  })

  return {
    mission: missionQ.data ?? null,
    missionLoading: missionQ.isLoading && !missionQ.data,
    timeline: timelineQ.data ?? [],
    timelineLoading: Boolean(timelineQ.isLoading && !timelineQ.data),
    modules: modulesQ.data?.modules ?? [],
    overallHealth: modulesQ.data?.overallHealth ?? { score: null, calibrating: true },
    reloadMission: () => void missionQ.refetch(),
  }
}
