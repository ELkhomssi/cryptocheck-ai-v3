import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const memoryBuckets = new Map<string, number[]>()

function memorySlidingWindow(key: string, maxRequests: number, windowMs: number) {
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
      limit: maxRequests,
    }
  }
  trimmed.push(now)
  memoryBuckets.set(key, trimmed)
  return {
    ok: true,
    remaining: maxRequests - trimmed.length,
    reset: now + windowMs,
    limit: maxRequests,
  }
}

let scanRl: Ratelimit | null = null
let auditRl: Ratelimit | null = null

function redis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  return Redis.fromEnv()
}

function getScanLimiter(): Ratelimit | null {
  const r = redis()
  if (!r) return null
  if (!scanRl) {
    scanRl = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      prefix: 'cc:rl:pro_public_scan',
      analytics: false,
    })
  }
  return scanRl
}

function getAuditLimiter(): Ratelimit | null {
  const r = redis()
  if (!r) return null
  if (!auditRl) {
    auditRl = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(15, '1 h'),
      prefix: 'cc:rl:pro_public_audit',
      analytics: false,
    })
  }
  return auditRl
}

export type PublicPortalLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  reset: number
}

export async function enforcePublicProScanLimit(ip: string): Promise<PublicPortalLimitResult> {
  const limiter = getScanLimiter()
  if (!limiter) {
    const m = memorySlidingWindow(`pro_scan:${ip}`, 5, 3_600_000)
    return { ok: m.ok, limit: m.limit, remaining: m.remaining, reset: m.reset }
  }
  const out = await limiter.limit(ip)
  return {
    ok: out.success,
    limit: out.limit,
    remaining: out.remaining,
    reset: out.reset,
  }
}

export async function enforcePublicProAuditLimit(ip: string): Promise<PublicPortalLimitResult> {
  const limiter = getAuditLimiter()
  if (!limiter) {
    const m = memorySlidingWindow(`pro_audit:${ip}`, 15, 3_600_000)
    return { ok: m.ok, limit: m.limit, remaining: m.remaining, reset: m.reset }
  }
  const out = await limiter.limit(ip)
  return {
    ok: out.success,
    limit: out.limit,
    remaining: out.remaining,
    reset: out.reset,
  }
}
