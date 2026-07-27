'use client'

/**
 * Observations hook — Mission Control OS may surface these alongside the core board.
 */

import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { buildObservations } from '@/lib/portfolio-desk/mission-narrative'
import type { ModuleCardView } from '@/types/intelligence'
import type { MissionViewModel } from '@/types/intelligence-core'

export function useMissionObservations() {
  const { walletAddress } = useSolana()
  const missionQ = useQuery({
    queryKey: ['intelligence-core-mission', walletAddress],
    queryFn: async () => {
      const q = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : ''
      const res = await fetch(`/api/intelligence-core/mission${q}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Mission view unavailable')
      return (await res.json()) as MissionViewModel
    },
    refetchInterval: 20_000,
    staleTime: 10_000,
  })
  const modulesQ = useQuery({
    queryKey: ['intelligence-modules'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence/modules', { cache: 'no-store' })
      if (!res.ok) return [] as ModuleCardView[]
      const body = (await res.json()) as { modules?: ModuleCardView[] }
      return body.modules ?? []
    },
    staleTime: 20_000,
  })
  return {
    observations: buildObservations({
      view: missionQ.data ?? null,
      modules: modulesQ.data ?? [],
    }),
    loading: missionQ.isLoading,
  }
}
