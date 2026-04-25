import { Redis } from '@upstash/redis'
import { createHash } from 'crypto'
import type { InstitutionalScanSnapshot } from '@/lib/services/scanner/types'

const TTL_SEC = 45
const PREFIX = 'institutional_scan:v1:'

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  return Redis.fromEnv()
}

/** Same normalization as reasoning cache for deduplication across routes. */
export function scanBodyCacheKey(body: Record<string, unknown>): string {
  const normalized = JSON.stringify(body, Object.keys(body).sort())
  return createHash('sha256').update(normalized).digest('hex').slice(0, 48)
}

export async function getInstitutionalScan(key: string): Promise<InstitutionalScanSnapshot | null> {
  const r = getRedis()
  if (!r) return null
  try {
    const raw = await r.get<string>(`${PREFIX}${key}`)
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed as InstitutionalScanSnapshot
  } catch {
    return null
  }
}

export async function setInstitutionalScan(
  key: string,
  value: InstitutionalScanSnapshot
): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    await r.set(`${PREFIX}${key}`, JSON.stringify(value), { ex: TTL_SEC })
  } catch (e) {
    console.warn('[ScannerCache] set failed', e)
  }
}
