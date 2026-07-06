import {
  SIGNAL_FEED_CACHE_KEY,
  SIGNAL_PUBSUB_CHANNEL,
  SIGNAL_STREAM_FEED,
  type UnifiedFeedEvent,
  type UnifiedSignal,
} from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'

const FEED_MAX = Number(process.env.SIGNAL_FEED_CACHE_SIZE ?? 500)
const FEED_TTL_SEC = 60 * 60

export async function publishUnifiedFeedEvent(
  redis: Redis,
  event: UnifiedFeedEvent,
): Promise<void> {
  const payload = JSON.stringify(event)
  await redis.publish(SIGNAL_PUBSUB_CHANNEL, payload)
  await redis.xadd(SIGNAL_STREAM_FEED, '*', { data: payload })
}

export async function updateUnifiedFeedCache(
  redis: Redis,
  signal: UnifiedSignal,
  mode: 'new' | 'update' | 'remove',
): Promise<void> {
  const raw = await redis.get<string>(SIGNAL_FEED_CACHE_KEY)
  let list: UnifiedSignal[] = []
  if (raw) {
    try {
      list = JSON.parse(raw) as UnifiedSignal[]
    } catch {
      list = []
    }
  }

  if (mode === 'remove' || signal.dropped) {
    list = list.filter((s) => s.id !== signal.id)
  } else if (mode === 'update') {
    const idx = list.findIndex((s) => s.id === signal.id)
    if (idx >= 0) list[idx] = signal
    else list.unshift(signal)
  } else {
    list.unshift(signal)
  }

  list = list.filter((s) => !s.dropped).slice(0, FEED_MAX)
  await redis.set(SIGNAL_FEED_CACHE_KEY, JSON.stringify(list), { ex: FEED_TTL_SEC })
}

export async function removeFromUnifiedFeedCache(redis: Redis, signalId: string): Promise<void> {
  const raw = await redis.get<string>(SIGNAL_FEED_CACHE_KEY)
  if (!raw) return
  let list: UnifiedSignal[] = []
  try {
    list = JSON.parse(raw) as UnifiedSignal[]
  } catch {
    return
  }
  list = list.filter((s) => s.id !== signalId)
  await redis.set(SIGNAL_FEED_CACHE_KEY, JSON.stringify(list), { ex: FEED_TTL_SEC })
}
