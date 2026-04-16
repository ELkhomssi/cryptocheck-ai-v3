/**
 * Intelligence report / ticker cache: Upstash Redis REST (fetch) with in-memory fallback.
 * No @upstash/redis — uses the same env vars as rate-limit.service.ts.
 */

type MemoryEntry = { value: string; expiresAt: number }

const memory = new Map<string, MemoryEntry>()

function upstashEnabled(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

async function upstashCommand(args: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    throw new Error(`Upstash HTTP ${res.status}: ${await res.text()}`)
  }
  const j = (await res.json()) as { result?: unknown; error?: string }
  if (j.error) throw new Error(j.error)
  return j.result
}

function memGet(key: string): string | null {
  const e = memory.get(key)
  if (!e) return null
  if (Date.now() > e.expiresAt) {
    memory.delete(key)
    return null
  }
  return e.value
}

function memSet(key: string, value: string, ttlSec: number): void {
  memory.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 })
}

/**
 * GET JSON value from cache, or null if missing/expired.
 */
export async function intelCacheGetJson<T>(key: string): Promise<T | null> {
  try {
    if (upstashEnabled()) {
      const raw = await upstashCommand(['GET', key])
      if (raw == null || raw === '') return null
      return JSON.parse(String(raw)) as T
    }
    const s = memGet(key)
    if (!s) return null
    return JSON.parse(s) as T
  } catch (e) {
    console.error('[intel-cache] get', key, e)
    return null
  }
}

/**
 * SET JSON value with TTL (seconds).
 */
export async function intelCacheSetJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  const payload = JSON.stringify(value)
  try {
    if (upstashEnabled()) {
      await upstashCommand(['SET', key, payload, 'EX', String(ttlSec)])
      return
    }
    memSet(key, payload, ttlSec)
  } catch (e) {
    console.error('[intel-cache] set', key, e)
  }
}
