import 'server-only'

import { redis } from '@/lib/cache/redis'

const PREFIX = 'ccai:b2b:prov:'

const mem = new Map<string, { v: unknown; exp: number }>()

type Box = { __box: 1; v: unknown }

function fullKey(key: string): string {
  return key.startsWith(PREFIX) ? key : `${PREFIX}${key}`
}

function serialize(value: unknown): string {
  const boxed: Box = { __box: 1, v: value }
  return JSON.stringify(boxed, (_k, v) => {
    if (v instanceof Map) {
      return { __type: 'Map', entries: [...v.entries()] }
    }
    return v
  })
}

function deserializeValue<T>(raw: string): T | undefined {
  const parsed = JSON.parse(raw, (_k, v) => {
    if (
      v &&
      typeof v === 'object' &&
      (v as { __type?: string }).__type === 'Map' &&
      Array.isArray((v as { entries?: unknown }).entries)
    ) {
      return new Map((v as { entries: [unknown, unknown][] }).entries)
    }
    return v
  }) as unknown
  if (parsed && typeof parsed === 'object' && (parsed as Box).__box === 1) {
    return (parsed as Box).v as T
  }
  // Legacy / unboxed payload
  return parsed as T
}

function memGet<T>(key: string): { hit: true; value: T } | { hit: false } {
  const hit = mem.get(key)
  if (!hit) return { hit: false }
  if (Date.now() > hit.exp) {
    mem.delete(key)
    return { hit: false }
  }
  return { hit: true, value: hit.v as T }
}

function memSet(key: string, value: unknown, ttlSec: number): void {
  mem.set(key, { v: value, exp: Date.now() + ttlSec * 1000 })
}

/** GET JSON from Redis (prefixed), then in-memory fallback. */
export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const k = fullKey(key)
  try {
    const raw = await redis.get(k)
    if (raw != null && raw !== '') {
      return deserializeValue<T>(raw) as T
    }
  } catch {
    // fall through to memory
  }
  const m = memGet<T>(k)
  return m.hit ? m.value : null
}

/** Internal get that distinguishes miss from cached null/undefined. */
async function cacheGetBoxed<T>(key: string): Promise<{ hit: true; value: T } | { hit: false }> {
  const k = fullKey(key)
  try {
    const raw = await redis.get(k)
    if (raw != null && raw !== '') {
      return { hit: true, value: deserializeValue<T>(raw) as T }
    }
  } catch {
    // fall through
  }
  return memGet<T>(k)
}

/** SET JSON in Redis + in-memory with TTL (seconds). */
export async function cacheSetJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  const k = fullKey(key)
  const payload = serialize(value)
  memSet(k, value, ttlSec)
  try {
    await redis.setex(k, ttlSec, payload)
  } catch {
    // memory already set
  }
}

/**
 * Redis-backed TTL cache with in-memory fallback.
 * Keys are prefixed with `ccai:b2b:prov:`.
 * Caches null results correctly (miss ≠ null).
 */
export async function cachedJson<T>(
  key: string,
  ttlSec: number,
  fn: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGetBoxed<T>(key)
  if (cached.hit) return cached.value

  const value = await fn()
  await cacheSetJson(key, value, ttlSec)
  return value
}
