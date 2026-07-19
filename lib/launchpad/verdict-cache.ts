/**
 * Pre-scanned Neural V4 verdict cache for verified snipes.
 * Keys: ccai:sig:verdict:{mint} — never scan:v2: (frozen).
 */
import { VERDICT_CACHE_PREFIX, VERDICT_CACHE_TTL_SEC } from '@/lib/launchpad/constants'

export type CachedVerdict = {
  mint: string
  verdict: 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'BLOCKED' | 'DANGER'
  /** Higher = safer (0–100). */
  score: number
  riskScore: number
  factors: string[]
  scannedAt: string
}

function redisEnabled(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

async function upstashCommand<T = unknown>(args: (string | number)[]): Promise<T | null> {
  if (!redisEnabled()) return null
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`)
  const j = (await res.json()) as { result?: T; error?: string }
  if (j.error) throw new Error(j.error)
  return (j.result ?? null) as T | null
}

function key(mint: string): string {
  return `${VERDICT_CACHE_PREFIX}${mint.trim()}`
}

export async function setCachedVerdict(
  entry: CachedVerdict,
  ttlSec = VERDICT_CACHE_TTL_SEC,
): Promise<void> {
  try {
    await upstashCommand(['SET', key(entry.mint), JSON.stringify(entry), 'EX', Math.max(30, ttlSec)])
  } catch {
    /* best-effort */
  }
}

export async function getCachedVerdict(mint: string): Promise<CachedVerdict | null> {
  try {
    const raw = await upstashCommand<string | null>(['GET', key(mint)])
    if (!raw) return null
    return JSON.parse(raw) as CachedVerdict
  } catch {
    return null
  }
}

export function isVerdictStale(
  entry: CachedVerdict,
  maxAgeSec = VERDICT_CACHE_TTL_SEC,
): boolean {
  const age = Date.now() - Date.parse(entry.scannedAt)
  return !Number.isFinite(age) || age > maxAgeSec * 1000
}

/**
 * Cache-first risk read for sniper hot path.
 * Returns { path: 'cache-hit' | 'inline', entry } — never skips DANGER hard-block.
 */
export async function resolveVerdictForSnipe(
  mint: string,
  inlineScan: () => Promise<CachedVerdict>,
): Promise<{ path: 'cache-hit' | 'inline'; entry: CachedVerdict }> {
  const cached = await getCachedVerdict(mint)
  if (cached && !isVerdictStale(cached)) {
    return { path: 'cache-hit', entry: cached }
  }
  const fresh = await inlineScan()
  await setCachedVerdict(fresh)
  return { path: 'inline', entry: fresh }
}
