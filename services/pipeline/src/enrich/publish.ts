import {
  SIGNAL_FEED_CACHE_KEY,
  SIGNAL_PUBSUB_CHANNEL,
  SIGNAL_STREAM_FEED,
  type NormalizedSignal,
  type SignalFeedEvent,
  type UnifiedSignal,
} from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'
import { normalizedToUnified } from './to-unified.js'

const FEED_MAX = Number(process.env.SIGNAL_FEED_CACHE_SIZE ?? 500)
const FEED_TTL_SEC = 60 * 60

function toFeedEvent(event: SignalFeedEvent): SignalFeedEvent {
  if (event.type === 'signal.new' || event.type === 'signal.update') {
    // Legacy callers may pass NormalizedSignal-shaped objects; normalize to UnifiedSignal.
    const s = event.signal as UnifiedSignal & Partial<NormalizedSignal>
    if (s.subjectType) return event
    return {
      ...event,
      signal: normalizedToUnified(s as unknown as NormalizedSignal),
    }
  }
  return event
}

export async function publishFeedEvent(redis: Redis, event: SignalFeedEvent): Promise<void> {
  const payload = JSON.stringify(toFeedEvent(event))
  await redis.publish(SIGNAL_PUBSUB_CHANNEL, payload)
  await redis.xadd(SIGNAL_STREAM_FEED, '*', { data: payload })
}

export async function updateFeedCache(
  redis: Redis,
  signal: NormalizedSignal,
  mode: 'new' | 'update' | 'remove',
): Promise<void> {
  const unified = normalizedToUnified(signal)
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
    list = list.filter((s) => s.id !== unified.id)
  } else if (mode === 'update') {
    const idx = list.findIndex((s) => s.id === unified.id)
    if (idx >= 0) list[idx] = unified
    else list.unshift(unified)
  } else {
    list.unshift(unified)
  }

  list = list.filter((s) => !s.dropped).slice(0, FEED_MAX)
  await redis.set(SIGNAL_FEED_CACHE_KEY, JSON.stringify(list), { ex: FEED_TTL_SEC })
}

export async function removeFromFeedCache(redis: Redis, signalId: string): Promise<void> {
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
