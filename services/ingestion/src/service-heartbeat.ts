import { Redis } from '@upstash/redis'
import {
  heartbeatRedisKey,
  SIGNAL_HEARTBEAT_TTL_SEC,
  type PipelineServiceName,
  type ServiceHeartbeatPayload,
} from '@cryptocheck/signal-contracts'

export function createServiceHeartbeat(service: PipelineServiceName) {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) {
    console.warn('[service-heartbeat] Redis env missing — heartbeat disabled')
    return { beat: async () => {}, start: () => () => {} }
  }

  const client = new Redis({ url, token })
  let timer: ReturnType<typeof setInterval> | null = null

  const beat = async (patch: Partial<ServiceHeartbeatPayload> = {}) => {
    const payload: ServiceHeartbeatPayload = {
      service,
      ts: Date.now(),
      status: 'ok',
      ...patch,
    }
    await client.set(heartbeatRedisKey(service), JSON.stringify(payload), {
      ex: SIGNAL_HEARTBEAT_TTL_SEC,
    })
  }

  const start = (getPatch: () => Partial<ServiceHeartbeatPayload>, intervalMs = 15_000) => {
    const tick = () => {
      void beat(getPatch()).catch((e) =>
        console.warn('[service-heartbeat] write failed', e instanceof Error ? e.message : e),
      )
    }
    tick()
    timer = setInterval(tick, intervalMs)
    return () => {
      if (timer) clearInterval(timer)
      timer = null
    }
  }

  return { beat, start }
}
