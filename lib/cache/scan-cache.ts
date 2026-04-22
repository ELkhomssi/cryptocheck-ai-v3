import { Redis } from '@upstash/redis'
import type { InstitutionalScanSnapshot } from '@/lib/services/scanner/types'

const redis = (): Redis | null => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  return Redis.fromEnv()
}

/** On-chain / RPC enrichment slice (Helius-backed JSON-RPC). */
export const SCAN_HELIUS_PREFIX = 'helius:'
/** Reserved for DAS / asset-listing calls (future). */
export const SCAN_DAS_PREFIX = 'das:'
/** DexScreener metrics for scan prep (aligned with `lib/dexscreener/fetch-token-metrics.ts`). */
export const SCAN_DEX_PREFIX = 'dex:'

const HELIUS_TTL_SEC = 60
const DAS_TTL_SEC = 120

type MintKeyedPayload = { bodyHash: string; snapshot: InstitutionalScanSnapshot }

const SCAN_V2_PREFIX = 'scan:v2:'
const SCAN_V2_TTL_SEC = 45

export async function scanCacheGetJson<T>(prefix: string, mint: string): Promise<T | null> {
  const r = redis()
  if (!r) return null
  try {
    const raw = await r.get<string>(`${prefix}${mint}`)
    if (!raw) return null
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T
  } catch {
    return null
  }
}

export async function scanCacheSetJson<T>(prefix: string, mint: string, value: T, ttlSec: number): Promise<void> {
  const r = redis()
  if (!r) return
  try {
    await r.set(`${prefix}${mint}`, JSON.stringify(value), { ex: ttlSec })
  } catch {
    /* best-effort */
  }
}

export async function getHeliusEnrichmentSlice<T>(mint: string): Promise<T | null> {
  return scanCacheGetJson<T>(SCAN_HELIUS_PREFIX, mint)
}

export async function setHeliusEnrichmentSlice<T>(mint: string, value: T): Promise<void> {
  await scanCacheSetJson(SCAN_HELIUS_PREFIX, mint, value, HELIUS_TTL_SEC)
}

export async function getDasSlice<T>(mint: string): Promise<T | null> {
  return scanCacheGetJson<T>(SCAN_DAS_PREFIX, mint)
}

export async function setDasSlice<T>(mint: string, value: T): Promise<void> {
  await scanCacheSetJson(SCAN_DAS_PREFIX, mint, value, DAS_TTL_SEC)
}

/**
 * Fast path: same mint + identical normalized body hash → return cached snapshot (45s).
 */
export async function getMintKeyedScanV2(
  mint: string,
  bodyHash: string
): Promise<InstitutionalScanSnapshot | null> {
  const r = redis()
  if (!r) return null
  try {
    const raw = await r.get<string>(`${SCAN_V2_PREFIX}${mint}`)
    if (!raw) return null
    const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as MintKeyedPayload
    if (!parsed?.snapshot || parsed.bodyHash !== bodyHash) return null
    return parsed.snapshot
  } catch {
    return null
  }
}

export async function setMintKeyedScanV2(
  mint: string,
  bodyHash: string,
  snapshot: InstitutionalScanSnapshot
): Promise<void> {
  const r = redis()
  if (!r) return
  try {
    const payload: MintKeyedPayload = { bodyHash, snapshot }
    await r.set(`${SCAN_V2_PREFIX}${mint}`, JSON.stringify(payload), { ex: SCAN_V2_TTL_SEC })
  } catch {
    /* best-effort */
  }
}
