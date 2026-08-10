'use client'

/**
 * Left-rail badge / system-status sources — real counts only.
 * Never invent whale/automation/engine totals for a empty account.
 */

import { useQuery } from '@tanstack/react-query'
import { useWhaleMovements } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { useTerminalOsStore } from '@/stores/terminal-os'

export type SystemHealthSummary = {
  ok: number
  total: number
  status: 'healthy' | 'degraded' | 'unknown'
  label: string
}

type HealthPayload = {
  status?: 'healthy' | 'degraded'
  checks?: Record<string, { ok?: boolean }>
}

export function useRailBadges() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const whalesQ = useWhaleMovements(32)

  const healthQ = useQuery({
    queryKey: ['tos', 'rail-health'],
    queryFn: async (): Promise<SystemHealthSummary> => {
      const res = await fetch('/api/health', { cache: 'no-store' })
      const body = (await res.json().catch(() => ({}))) as HealthPayload
      const checks = body.checks ?? {}
      const entries = Object.values(checks)
      const total = entries.length
      if (total === 0) {
        return {
          ok: 0,
          total: 0,
          status: 'unknown',
          label: 'System status unavailable',
        }
      }
      const ok = entries.filter((c) => c?.ok === true).length
      const status = body.status === 'healthy' && ok === total ? 'healthy' : 'degraded'
      return {
        ok,
        total,
        status,
        label:
          status === 'healthy'
            ? `ALL SYSTEMS ONLINE ${ok}/${total} Engines`
            : `Degraded ${ok}/${total} Engines`,
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  })

  const alertsQ = useQuery({
    queryKey: ['tos', 'rail-alerts', wallet],
    enabled: Boolean(wallet),
    queryFn: async () => {
      const res = await fetch(
        `/api/terminal-os/alerts?wallet=${encodeURIComponent(wallet!)}`,
        { cache: 'no-store' },
      )
      if (!res.ok) return { rules: 0, fired: 0 }
      const body = (await res.json()) as { rules?: unknown[]; fired?: unknown[] }
      return {
        rules: Array.isArray(body.rules) ? body.rules.length : 0,
        fired: Array.isArray(body.fired) ? body.fired.length : 0,
      }
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
    retry: 1,
  })

  const dnaQ = useQuery({
    queryKey: ['tos', 'rail-dna', wallet],
    enabled: Boolean(wallet),
    queryFn: async () => {
      const res = await fetch(
        `/api/terminal-os/dna?wallet=${encodeURIComponent(wallet!)}`,
        { cache: 'no-store' },
      )
      if (!res.ok) return null
      const body = (await res.json()) as {
        dna?: { confidence?: number; sampleSize?: number } | null
      }
      const dna = body.dna
      if (!dna || (dna.sampleSize ?? 0) < 3) return null
      return typeof dna.confidence === 'number' ? Math.round(dna.confidence) : null
    },
    staleTime: 60_000,
    retry: 1,
  })

  const whaleCount = whalesQ.data?.length ?? 0
  const whaleBadge =
    whalesQ.isSuccess && whaleCount > 0 ? whaleCount : null

  const automationBadge =
    wallet && alertsQ.isSuccess && (alertsQ.data?.rules ?? 0) > 0
      ? alertsQ.data!.rules
      : null

  const alertBadge =
    wallet && alertsQ.isSuccess && (alertsQ.data?.fired ?? 0) > 0
      ? alertsQ.data!.fired
      : null

  return {
    whaleBadge,
    automationBadge,
    alertBadge,
    dnaPct: dnaQ.data ?? null,
    health: healthQ.data ?? {
      ok: 0,
      total: 0,
      status: 'unknown' as const,
      label: healthQ.isLoading ? 'Checking systems…' : 'System status unavailable',
    },
    healthLoading: healthQ.isLoading,
  }
}
