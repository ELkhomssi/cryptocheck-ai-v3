import {
  heartbeatRedisKey,
  isHeartbeatFresh,
  parseServiceHeartbeat,
  type PipelineServiceName,
  type ServiceHeartbeatPayload,
} from '@cryptocheck/signal-contracts'
import { redis } from '@/lib/cache/redis'

export async function readServiceHeartbeat(
  service: PipelineServiceName,
): Promise<ServiceHeartbeatPayload | null> {
  const raw = await redis.get(heartbeatRedisKey(service))
  return parseServiceHeartbeat(raw)
}

export async function readTelegramMonitorHeartbeat(): Promise<ServiceHeartbeatPayload | null> {
  return readServiceHeartbeat('telegram-monitor')
}

export function heartbeatToSourceStatus(hb: ServiceHeartbeatPayload): {
  live: boolean
  channelCount: number
} {
  const channelCount = hb.channels ?? 0
  return {
    live: hb.status !== 'down' && channelCount > 0,
    channelCount,
  }
}
