'use client'

/**
 * System Status multi-gauge — real /api/health + /api/terminal/provider-health.
 * Never fabricates 12/12 or latency.
 */

import { useQuery } from '@tanstack/react-query'
import { useExecutionLifecycleBridge } from '@/features/terminal-os/money-lifecycle/execution-lifecycle-bridge'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'

type HealthPayload = {
  status?: 'healthy' | 'degraded'
  latency_ms?: number
  checks?: Record<string, { ok?: boolean; latency_ms?: number }>
}

type ProviderHealth = {
  providers?: Record<string, { ok?: boolean; latencyMs?: number }>
}

function Gauge({
  label,
  value,
  detail,
  ok,
}: {
  label: string
  value: string
  detail?: string
  ok: boolean | null
}) {
  return (
    <div className="tos-sys-gauge" data-ok={ok == null ? 'unknown' : ok ? 'true' : 'false'}>
      <div className="tos-sys-gauge-ring" aria-hidden>
        <strong>{value}</strong>
      </div>
      <span className="tos-sys-gauge-label">{label}</span>
      {detail ? <span className="tos-sys-gauge-detail">{detail}</span> : null}
    </div>
  )
}

export function SystemStatusGauges() {
  const executionState = useExecutionLifecycleBridge((s) => s.executionState)
  const { state: tlm } = useTradeLikeMeEngine()

  const healthQ = useQuery({
    queryKey: ['tos', 'sys-gauges-health'],
    queryFn: async () => {
      const res = await fetch('/api/health', { cache: 'no-store' })
      return (await res.json().catch(() => ({}))) as HealthPayload
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const providersQ = useQuery({
    queryKey: ['tos', 'sys-gauges-providers'],
    queryFn: async () => {
      const res = await fetch('/api/terminal/provider-health', { cache: 'no-store' })
      if (!res.ok) return null
      return (await res.json().catch(() => null)) as ProviderHealth | null
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  })

  const checks = Object.values(healthQ.data?.checks ?? {})
  const enginesOk = checks.filter((c) => c?.ok === true).length
  const enginesTotal = checks.length
  const enginesLabel =
    enginesTotal > 0 ? `${enginesOk}/${enginesTotal}` : '—'

  const providers = Object.entries(providersQ.data?.providers ?? {})
  const feedsOk = providers.filter(([, p]) => p?.ok).length
  const feedsTotal = providers.length
  const feedsLabel = feedsTotal > 0 ? `${feedsOk}/${feedsTotal}` : '—'

  const latencyCandidates = [
    healthQ.data?.latency_ms,
    ...checks.map((c) => c?.latency_ms).filter((n): n is number => typeof n === 'number'),
    ...providers.map(([, p]) => p?.latencyMs).filter((n): n is number => typeof n === 'number'),
  ].filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
  const latencyMs =
    latencyCandidates.length > 0
      ? Math.round(latencyCandidates.reduce((a, b) => a + b, 0) / latencyCandidates.length)
      : null

  const execOk =
    executionState === 'confirmed' ||
    executionState === 'building' ||
    executionState === 'awaiting_signature'
  const learning =
    tlm.dna && tlm.dna.sampleSize > 0 && !tlm.dna.sample
      ? `DNA ${tlm.dna.confidence}%`
      : 'Training'

  return (
    <div className="tos-desk-panel tos-sys-status" data-tos-sys-status="true">
      <header className="tos-desk-panel-head">
        <span>System Status</span>
        <span
          className="tos-desk-live"
          data-on={healthQ.data?.status === 'healthy' ? 'true' : 'false'}
        >
          {healthQ.data?.status === 'healthy'
            ? 'Online'
            : healthQ.data?.status === 'degraded'
              ? 'Degraded'
              : 'Checking'}
        </span>
      </header>
      <div className="tos-sys-gauges" role="list">
        <Gauge
          label="AI Engines"
          value={enginesLabel}
          detail={enginesTotal ? 'From /api/health' : 'Unavailable'}
          ok={enginesTotal > 0 ? enginesOk === enginesTotal : null}
        />
        <Gauge
          label="Data Feeds"
          value={feedsLabel}
          detail={feedsTotal ? 'Provider health' : 'Unavailable'}
          ok={feedsTotal > 0 ? feedsOk === feedsTotal : null}
        />
        <Gauge
          label="Execution"
          value={executionState.replace(/_/g, ' ')}
          detail="Lifecycle bridge"
          ok={execOk}
        />
        <Gauge
          label="Learning"
          value={tlm.dna && !tlm.dna.sample ? `${tlm.dna.sampleSize}` : '—'}
          detail={learning}
          ok={tlm.dna && !tlm.dna.sample ? true : null}
        />
        <Gauge
          label="Latency"
          value={latencyMs != null ? `${latencyMs}ms` : '—'}
          detail={latencyMs != null ? 'Avg health sample' : 'No sample'}
          ok={latencyMs != null ? latencyMs < 800 : null}
        />
      </div>
    </div>
  )
}
