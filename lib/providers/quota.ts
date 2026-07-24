import 'server-only'

/**
 * Provider quota + soft/hard rate limiting.
 *
 * Tracks per-provider request usage (minute + day windows) in Redis
 * (`ccai:b2b:quota:`) with an in-memory fallback. Soft threshold slows
 * callers; hard threshold refuses the upstream call safely.
 *
 * Override limits via env, e.g. BIRDEYE_RPM=30 BIRDEYE_DAILY_QUOTA=5000
 */

import { redis } from '@/lib/cache/redis'

export type ProviderId =
  | 'birdeye'
  | 'jupiter'
  | 'helius'
  | 'coingecko'
  | 'raydium'
  | 'dexscreener'
  | 'anthropic'

export type QuotaDecision =
  | { ok: true; delayedMs: number; remainingMinute: number; remainingDay: number; usage: QuotaUsage }
  | { ok: false; reason: 'minute_exhausted' | 'day_exhausted' | 'paused'; retryAfterMs: number; usage: QuotaUsage }

export type QuotaUsage = {
  provider: ProviderId
  minuteUsed: number
  minuteLimit: number
  dayUsed: number
  dayLimit: number
  softRatio: number
  pausedUntil: number
}

type ProviderQuotaConfig = {
  /** Max requests per rolling minute. */
  rpm: number
  /** Max requests per UTC day. */
  daily: number
  /** Fraction of limit at which we start delaying (0–1). */
  softRatio: number
  /** Max soft-throttle delay in ms. */
  maxDelayMs: number
  /** How long to pause after an upstream 429 (ms). */
  pauseOn429Ms: number
}

const DEFAULTS: Record<ProviderId, ProviderQuotaConfig> = {
  // Birdeye free/standard tiers are strict — stay conservative.
  birdeye: { rpm: 40, daily: 8_000, softRatio: 0.75, maxDelayMs: 2_500, pauseOn429Ms: 30_000 },
  jupiter: { rpm: 120, daily: 50_000, softRatio: 0.8, maxDelayMs: 1_000, pauseOn429Ms: 15_000 },
  helius: { rpm: 300, daily: 100_000, softRatio: 0.85, maxDelayMs: 800, pauseOn429Ms: 20_000 },
  coingecko: { rpm: 25, daily: 9_000, softRatio: 0.7, maxDelayMs: 3_000, pauseOn429Ms: 60_000 },
  raydium: { rpm: 60, daily: 30_000, softRatio: 0.8, maxDelayMs: 1_200, pauseOn429Ms: 20_000 },
  dexscreener: { rpm: 50, daily: 20_000, softRatio: 0.75, maxDelayMs: 2_000, pauseOn429Ms: 45_000 },
  anthropic: { rpm: 30, daily: 2_000, softRatio: 0.8, maxDelayMs: 2_000, pauseOn429Ms: 60_000 },
}

const PREFIX = 'ccai:b2b:quota:'

type MemCounter = { n: number; exp: number }
const memCounters = new Map<string, MemCounter>()
const memPaused = new Map<ProviderId, number>()

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

export function getProviderQuotaConfig(provider: ProviderId): ProviderQuotaConfig {
  const base = DEFAULTS[provider]
  const envKey = provider.toUpperCase()
  return {
    rpm: envInt(`${envKey}_RPM`, base.rpm),
    daily: envInt(`${envKey}_DAILY_QUOTA`, base.daily),
    softRatio: base.softRatio,
    maxDelayMs: base.maxDelayMs,
    pauseOn429Ms: base.pauseOn429Ms,
  }
}

function minuteBucket(now = Date.now()): string {
  return String(Math.floor(now / 60_000))
}

function dayBucket(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10) // YYYY-MM-DD UTC
}

function memIncr(key: string, ttlMs: number): number {
  const now = Date.now()
  const cur = memCounters.get(key)
  if (!cur || now > cur.exp) {
    memCounters.set(key, { n: 1, exp: now + ttlMs })
    return 1
  }
  cur.n += 1
  return cur.n
}

function memGet(key: string): number {
  const cur = memCounters.get(key)
  if (!cur || Date.now() > cur.exp) return 0
  return cur.n
}

async function redisIncr(key: string, ttlSec: number): Promise<number | null> {
  try {
    const n = await redis.incr(key)
    if (n === 1) await redis.expire(key, ttlSec)
    return typeof n === 'number' ? n : Number(n)
  } catch {
    return null
  }
}

async function redisGetNum(key: string): Promise<number | null> {
  try {
    const raw = await redis.get(key)
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

async function readPausedUntil(provider: ProviderId): Promise<number> {
  const mem = memPaused.get(provider) ?? 0
  try {
    const raw = await redis.get(`${PREFIX}pause:${provider}`)
    const n = raw != null && raw !== '' ? Number(raw) : 0
    const paused = Number.isFinite(n) ? n : 0
    return Math.max(mem, paused)
  } catch {
    return mem
  }
}

/**
 * Mark provider paused after upstream 429 / quota errors.
 * Subsequent acquire() calls fail until the pause expires.
 */
export async function pauseProvider(provider: ProviderId, ms?: number): Promise<void> {
  const cfg = getProviderQuotaConfig(provider)
  const until = Date.now() + (ms ?? cfg.pauseOn429Ms)
  memPaused.set(provider, until)
  try {
    const ttlSec = Math.max(1, Math.ceil((until - Date.now()) / 1000))
    await redis.setex(`${PREFIX}pause:${provider}`, ttlSec, String(until))
  } catch {
    /* memory already set */
  }
}

export async function getProviderUsage(provider: ProviderId): Promise<QuotaUsage> {
  const cfg = getProviderQuotaConfig(provider)
  const now = Date.now()
  const mKey = `${PREFIX}${provider}:m:${minuteBucket(now)}`
  const dKey = `${PREFIX}${provider}:d:${dayBucket(now)}`
  const [mRedis, dRedis] = await Promise.all([redisGetNum(mKey), redisGetNum(dKey)])
  const minuteUsed = mRedis ?? memGet(mKey)
  const dayUsed = dRedis ?? memGet(dKey)
  const pausedUntil = await readPausedUntil(provider)
  return {
    provider,
    minuteUsed,
    minuteLimit: cfg.rpm,
    dayUsed,
    dayLimit: cfg.daily,
    softRatio: cfg.softRatio,
    pausedUntil,
  }
}

function softDelayMs(used: number, limit: number, softRatio: number, maxDelayMs: number): number {
  const softAt = limit * softRatio
  if (used < softAt) return 0
  if (limit <= 0) return maxDelayMs
  const overshoot = (used - softAt) / Math.max(1, limit - softAt)
  // 0 → maxDelay as we approach the hard limit
  return Math.min(maxDelayMs, Math.floor(overshoot * maxDelayMs))
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Acquire permission to make `cost` upstream requests (default 1).
 * Soft-threshold: awaits a delay then allows. Hard: rejects without calling upstream.
 */
export async function acquireProviderQuota(
  provider: ProviderId,
  cost = 1,
): Promise<QuotaDecision> {
  const cfg = getProviderQuotaConfig(provider)
  const now = Date.now()
  const pausedUntil = await readPausedUntil(provider)
  if (pausedUntil > now) {
    const usage = await getProviderUsage(provider)
    return {
      ok: false,
      reason: 'paused',
      retryAfterMs: pausedUntil - now,
      usage,
    }
  }

  const mKey = `${PREFIX}${provider}:m:${minuteBucket(now)}`
  const dKey = `${PREFIX}${provider}:d:${dayBucket(now)}`

  // Peek first — refuse before incrementing if already exhausted
  const [mPeek, dPeek] = await Promise.all([redisGetNum(mKey), redisGetNum(dKey)])
  const minuteUsed = mPeek ?? memGet(mKey)
  const dayUsed = dPeek ?? memGet(dKey)

  if (minuteUsed + cost > cfg.rpm) {
    const usage = await getProviderUsage(provider)
    return {
      ok: false,
      reason: 'minute_exhausted',
      retryAfterMs: 60_000 - (now % 60_000),
      usage,
    }
  }
  if (dayUsed + cost > cfg.daily) {
    const usage = await getProviderUsage(provider)
    const tomorrow = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      new Date(now).getUTCDate() + 1,
    )
    return {
      ok: false,
      reason: 'day_exhausted',
      retryAfterMs: Math.max(1_000, tomorrow - now),
      usage,
    }
  }

  // Commit usage
  const mRedis = await redisIncr(mKey, 120)
  const dRedis = await redisIncr(dKey, 90_000)
  let mAfter = mRedis
  let dAfter = dRedis
  if (mAfter == null) mAfter = memIncr(mKey, 120_000)
  if (dAfter == null) dAfter = memIncr(dKey, 86_400_000)
  // Extra cost units (batch of N counted as N)
  for (let i = 1; i < cost; i++) {
    const extraM = await redisIncr(mKey, 120)
    const extraD = await redisIncr(dKey, 90_000)
    mAfter = extraM ?? memIncr(mKey, 120_000)
    dAfter = extraD ?? memIncr(dKey, 86_400_000)
  }

  // Re-check after increment (race) — if we overshot, still delay hard on next calls
  if (mAfter! > cfg.rpm || dAfter! > cfg.daily) {
    const usage = await getProviderUsage(provider)
    return {
      ok: false,
      reason: mAfter! > cfg.rpm ? 'minute_exhausted' : 'day_exhausted',
      retryAfterMs: mAfter! > cfg.rpm ? 60_000 - (now % 60_000) : 3_600_000,
      usage,
    }
  }

  const delayedMs = Math.max(
    softDelayMs(mAfter!, cfg.rpm, cfg.softRatio, cfg.maxDelayMs),
    softDelayMs(dAfter!, cfg.daily, cfg.softRatio, cfg.maxDelayMs),
  )
  if (delayedMs > 0) await sleep(delayedMs)

  const usage: QuotaUsage = {
    provider,
    minuteUsed: mAfter!,
    minuteLimit: cfg.rpm,
    dayUsed: dAfter!,
    dayLimit: cfg.daily,
    softRatio: cfg.softRatio,
    pausedUntil: 0,
  }
  return {
    ok: true,
    delayedMs,
    remainingMinute: Math.max(0, cfg.rpm - mAfter!),
    remainingDay: Math.max(0, cfg.daily - dAfter!),
    usage,
  }
}

export class ProviderQuotaError extends Error {
  readonly provider: ProviderId
  readonly reason: 'minute_exhausted' | 'day_exhausted' | 'paused'
  readonly retryAfterMs: number
  readonly usage: QuotaUsage

  constructor(decision: Extract<QuotaDecision, { ok: false }>) {
    super(
      `Provider ${decision.usage.provider} quota ${decision.reason}; retry in ${decision.retryAfterMs}ms`,
    )
    this.name = 'ProviderQuotaError'
    this.provider = decision.usage.provider
    this.reason = decision.reason
    this.retryAfterMs = decision.retryAfterMs
    this.usage = decision.usage
  }
}

/**
 * Run `fn` only if quota allows. On hard deny, returns `onDenied` (default null).
 * Does not throw unless `throwOnDeny` is set.
 */
export async function withProviderQuota<T>(
  provider: ProviderId,
  fn: () => Promise<T>,
  opts?: { cost?: number; onDenied?: T; throwOnDeny?: boolean },
): Promise<T> {
  const decision = await acquireProviderQuota(provider, opts?.cost ?? 1)
  if (decision.ok === false) {
    if (opts?.throwOnDeny) throw new ProviderQuotaError(decision)
    return (opts && 'onDenied' in opts ? opts.onDenied : null) as T
  }
  return fn()
}

/**
 * Process items in batches with concurrency 1 per batch and inter-batch delay.
 * Each batch item call goes through quota (cost=1) unless `chargePerBatch` is set.
 */
export async function mapBatched<T, R>(
  items: T[],
  opts: {
    provider: ProviderId
    batchSize: number
    gapMs?: number
    chargePerBatch?: boolean
    onItem: (item: T, index: number) => Promise<R>
  },
): Promise<R[]> {
  const out: R[] = []
  const size = Math.max(1, opts.batchSize)
  const gap = opts.gapMs ?? 200
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size)
    const cost = opts.chargePerBatch ? 1 : slice.length
    const decision = await acquireProviderQuota(opts.provider, cost)
    if (decision.ok === false) {
      // Stop safely — return what we have so far
      break
    }
    const part = await Promise.all(slice.map((item, j) => opts.onItem(item, i + j)))
    out.push(...part)
    if (i + size < items.length && gap > 0) await sleep(gap)
  }
  return out
}

/** Chunk an array for API batch endpoints (e.g. Jupiter multi-mint). */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const n = Math.max(1, size)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n))
  return out
}

export async function getAllProviderUsage(): Promise<QuotaUsage[]> {
  const ids = Object.keys(DEFAULTS) as ProviderId[]
  return Promise.all(ids.map((id) => getProviderUsage(id)))
}
