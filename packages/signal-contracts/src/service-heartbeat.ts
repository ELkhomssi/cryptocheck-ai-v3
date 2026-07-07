/** Redis heartbeat keys — workers write; Next.js dashboard reads. */
export const SIGNAL_HEARTBEAT_PREFIX = 'ccai:sig:heartbeat:'
export const SIGNAL_HEARTBEAT_TTL_SEC = 45
export const SIGNAL_HEARTBEAT_STALE_MS = 45_000

export type PipelineServiceName =
  | 'telegram-monitor'
  | 'gate-worker'
  | 'realtime-gateway'
  | 'scanner'
  | 'sniper'

export type ServiceHeartbeatPayload = {
  service: PipelineServiceName
  /** Wall-clock ms when written. */
  ts: number
  status: 'ok' | 'degraded' | 'down'
  /** Telegram monitor: joined public channels. */
  channels?: number
  /** Optional processing lag hint (ms). */
  lagMs?: number
}

export function heartbeatRedisKey(service: PipelineServiceName | string): string {
  return `${SIGNAL_HEARTBEAT_PREFIX}${service}`
}

export function parseServiceHeartbeat(raw: string | null | undefined): ServiceHeartbeatPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ServiceHeartbeatPayload
    if (!parsed?.service || typeof parsed.ts !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function isHeartbeatFresh(hb: ServiceHeartbeatPayload | null, now = Date.now()): boolean {
  if (!hb) return false
  return now - hb.ts <= SIGNAL_HEARTBEAT_STALE_MS
}
