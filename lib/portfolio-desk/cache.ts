/** Simple in-memory TTL cache for free-tier rate limits (10–30s). */

type Entry<T> = { value: T; expiresAt: number }

const store = new Map<string, Entry<unknown>>()

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    store.delete(key)
    return null
  }
  return hit.value as T
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(key)
  if (hit != null) return hit
  const value = await fn()
  cacheSet(key, value, ttlMs)
  return value
}
