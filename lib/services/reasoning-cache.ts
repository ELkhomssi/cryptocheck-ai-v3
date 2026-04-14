import { createHash } from 'crypto'
import { Redis } from '@upstash/redis'
import type { ReasoningObject } from '@/lib/services/scanner-engine'

const TTL_SEC = 60

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  return Redis.fromEnv()
}

/** Stable cache key for identical scan inputs (Pro API body shape). */
export function reasoningCacheKey(body: Record<string, unknown>): string {
  const normalized = JSON.stringify(body, Object.keys(body).sort())
  const h = createHash('sha256').update(normalized).digest('hex').slice(0, 48)
  return `reasoning:v1:${h}`
}

export async function getCachedReasoning(key: string): Promise<ReasoningObject | null> {
  const r = getRedis()
  if (!r) return null
  try {
    const raw = await r.get<string>(key)
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed as ReasoningObject
  } catch {
    return null
  }
}

export async function setCachedReasoning(key: string, value: ReasoningObject): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    await r.set(key, JSON.stringify(value), { ex: TTL_SEC })
  } catch (e) {
    console.warn('[reasoning-cache] set failed', e)
  }
}
