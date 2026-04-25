import 'server-only'

import { collectHealthSnapshot } from '@/lib/status/health-snapshot'
import { PUBLIC_STATUS_SLA, readActiveIncidentsFromEnv } from '@/lib/status/sla'
import { getRollingAvailabilityPct, type RollingUptimeResult } from '@/lib/status/uptime-probes'

export type PublicStatusPayload = {
  overall: 'operational' | 'degraded' | 'partial'
  summary: string
  health: Awaited<ReturnType<typeof collectHealthSnapshot>>
  sla: typeof PUBLIC_STATUS_SLA
  uptime: RollingUptimeResult & { window_days: number }
  incidents: ReturnType<typeof readActiveIncidentsFromEnv>
  status_page_path: string
  updated_at: string
}

export async function getPublicStatusPayload(): Promise<PublicStatusPayload> {
  const health = await collectHealthSnapshot()
  const uptime30 = await getRollingAvailabilityPct(30)
  const incidents = readActiveIncidentsFromEnv()

  const dbOk = health.checks.database?.ok !== false
  const rpcOk = health.checks.rpc_primary?.ok !== false
  const redisOk = health.checks.redis?.ok !== false

  let overall: PublicStatusPayload['overall'] = 'operational'
  let summary = 'All critical systems are responding normally.'

  if (!dbOk || !rpcOk) {
    overall = 'degraded'
    summary = 'Core dependencies are impaired; scans may fail or be delayed.'
  } else if (!redisOk) {
    overall = 'partial'
    summary = 'Core APIs are up; optional Redis cache layer is impaired — rate limits may fall back to in-process mode.'
  }

  if (incidents.some((i) => i.severity === 'major')) {
    overall = overall === 'operational' ? 'partial' : overall
    summary = 'Active incident reported — see below.'
  }

  return {
    overall,
    summary,
    health,
    sla: PUBLIC_STATUS_SLA,
    uptime: { window_days: 30, ...uptime30 },
    incidents,
    status_page_path: '/status',
    updated_at: new Date().toISOString(),
  }
}
