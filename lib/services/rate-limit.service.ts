import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { SubscriptionTier } from '@/lib/types/tier'
import { TIER_RATE_LIMITS } from '@/lib/types/tier'

const memoryBuckets = new Map<string, number[]>()

let redisSingleton: Redis | null = null
const ratelimitByTier = new Map<SubscriptionTier, Ratelimit>()

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  if (!redisSingleton) {
    redisSingleton = Redis.fromEnv()
  }
  return redisSingleton
}

function getUpstashRatelimit(tier: SubscriptionTier): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  if (ratelimitByTier.has(tier)) {
    return ratelimitByTier.get(tier)!
  }
  const cfg = TIER_RATE_LIMITS[tier]
  const windowStr = `${cfg.windowSeconds} s` as `${number} s`
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(cfg.maxRequests, windowStr),
    prefix: `cc:rl:${tier}`,
    analytics: true,
  })
  ratelimitByTier.set(tier, rl)
  return rl
}

function memorySlidingWindow(
  key: string,
  maxRequests: number,
  windowMs: number
): { ok: boolean; remaining: number; reset: number } {
  const now = Date.now()
  const prev = memoryBuckets.get(key) || []
  const windowStart = now - windowMs
  const trimmed = prev.filter((t) => t > windowStart)
  if (trimmed.length >= maxRequests) {
    const oldest = Math.min(...trimmed)
    return {
      ok: false,
      remaining: 0,
      reset: oldest + windowMs,
    }
  }
  trimmed.push(now)
  memoryBuckets.set(key, trimmed)
  return {
    ok: true,
    remaining: maxRequests - trimmed.length,
    reset: now + windowMs,
  }
}

export type RateLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Redis sliding window (Upstash) when env is set; otherwise in-memory per runtime (dev / fallback).
 */
export async function enforceRateLimit(
  dedupeKey: string,
  tier: SubscriptionTier
): Promise<RateLimitResult> {
  const cfg = TIER_RATE_LIMITS[tier]
  const id = `${tier}:${dedupeKey}`
  const rl = getUpstashRatelimit(tier)

  if (rl) {
    const res = await rl.limit(id)
    return {
      ok: res.success,
      limit: res.limit,
      remaining: res.remaining,
      reset: res.reset,
    }
  }

  const windowMs = cfg.windowSeconds * 1000
  const mem = memorySlidingWindow(id, cfg.maxRequests, windowMs)
  return {
    ok: mem.ok,
    limit: cfg.maxRequests,
    remaining: mem.remaining,
    reset: mem.reset,
  }
}
