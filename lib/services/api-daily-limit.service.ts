import { Redis } from '@upstash/redis'
import { isSentinelQaBypassDedupeKey } from '@/lib/config/sentinel-qa-bypass'
import type { SubscriptionTier } from '@/lib/types/tier'
import { TIER_DAILY_API_LIMITS } from '@/lib/types/tier'

const memoryDaily = new Map<string, number>()

let redisSingleton: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  if (!redisSingleton) redisSingleton = Redis.fromEnv()
  return redisSingleton
}

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export type DailyLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  /** Epoch ms when the current UTC day bucket resets (start of next UTC day). */
  reset: number
}

function nextUtcMidnight(): number {
  const d = new Date()
  d.setUTCHours(24, 0, 0, 0)
  return d.getTime()
}

/**
 * Per-identity daily cap (UTC calendar day) for Security API usage.
 */
export async function enforceDailyApiLimit(
  dedupeKey: string,
  tier: SubscriptionTier
): Promise<DailyLimitResult> {
  const cfg = TIER_DAILY_API_LIMITS[tier]
  const limit = cfg.maxRequests
  const reset = nextUtcMidnight()

  if (isSentinelQaBypassDedupeKey(dedupeKey)) {
    return { ok: true, limit: 9_000_000, remaining: 9_000_000, reset }
  }

  if (limit >= 9_000_000) {
    return { ok: true, limit, remaining: limit, reset }
  }

  const day = utcDayKey()
  const id = `${tier}:${day}:${dedupeKey}`
  const r = getRedis()

  if (r) {
    try {
      const key = `cc:api:day:${id}`
      const n = await r.incr(key)
      if (n === 1) {
        await r.expire(key, 86_400 * 2)
      }
      const remaining = Math.max(0, limit - n)
      if (n > limit) {
        return { ok: false, limit, remaining: 0, reset }
      }
      return { ok: true, limit, remaining, reset }
    } catch {
      /* fall through to memory */
    }
  }

  const memKey = id
  const prev = memoryDaily.get(memKey) ?? 0
  const n = prev + 1
  memoryDaily.set(memKey, n)
  if (n > limit) {
    return { ok: false, limit, remaining: 0, reset }
  }
  return { ok: true, limit, remaining: limit - n, reset }
}

/**
 * Atomically reserves `count` daily units (e.g. batch scan of N tokens).
 */
export async function enforceDailyApiLimitCount(
  count: number,
  dedupeKey: string,
  tier: SubscriptionTier
): Promise<DailyLimitResult & { ok: boolean }> {
  const cfg = TIER_DAILY_API_LIMITS[tier]
  const limit = cfg.maxRequests
  const reset = nextUtcMidnight()

  if (isSentinelQaBypassDedupeKey(dedupeKey)) {
    return { ok: true, limit: 9_000_000, remaining: 9_000_000, reset }
  }

  if (count <= 0) {
    return { ok: true, limit, remaining: limit, reset }
  }

  if (limit >= 9_000_000) {
    return { ok: true, limit, remaining: limit, reset }
  }

  const day = utcDayKey()
  const id = `${tier}:${day}:${dedupeKey}`
  const r = getRedis()

  if (r) {
    try {
      const key = `cc:api:day:${id}`
      let newVal = 0
      for (let i = 0; i < count; i++) {
        newVal = await r.incr(key)
        if (i === 0) await r.expire(key, 86_400 * 2)
      }
      if (newVal > limit) {
        for (let i = 0; i < count; i++) await r.decr(key)
        return { ok: false, limit, remaining: 0, reset }
      }
      const remaining = Math.max(0, limit - newVal)
      return { ok: true, limit, remaining, reset }
    } catch {
      /* memory */
    }
  }

  const memKey = id
  const prev = memoryDaily.get(memKey) ?? 0
  const next = prev + count
  if (next > limit) {
    return { ok: false, limit, remaining: 0, reset }
  }
  memoryDaily.set(memKey, next)
  return { ok: true, limit, remaining: limit - next, reset }
}
