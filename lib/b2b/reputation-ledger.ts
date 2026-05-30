import 'server-only'

import { redis } from '@/lib/cache/redis'

export type ReputationVerdict = 'LOW_RISK' | 'CAUTION' | 'HIGH_RISK' | 'CRITICAL_RISK'

/** Persisted reputation snapshot keyed by chain + address (Redis `ccai:rep:`). */
export type ReputationSnapshot = {
  chain: string
  address: string
  /** 0–100 RISK score (higher = riskier). */
  riskScore: number
  verdict: ReputationVerdict
  /** 0–100 confidence in inputs. */
  confidence: number
  topSignals: string[]
  updatedAt: string
  source: 'live' | 'cache'
}

const REP_PREFIX = 'ccai:rep:v1:'
const REP_TTL_SEC = 300
/** Read-first fast path: return ledger hit when younger than this (ms). */
export const REP_READ_FIRST_MAX_AGE_MS = 120_000

function repKey(chain: string, address: string): string {
  return `${REP_PREFIX}${chain.toLowerCase()}:${address}`
}

export function riskScoreToVerdict(riskScore: number): ReputationVerdict {
  if (riskScore >= 85) return 'CRITICAL_RISK'
  if (riskScore >= 70) return 'HIGH_RISK'
  if (riskScore >= 40) return 'CAUTION'
  return 'LOW_RISK'
}

export async function readReputation(
  chain: string,
  address: string
): Promise<ReputationSnapshot | null> {
  try {
    const raw = await redis.get(repKey(chain, address))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ReputationSnapshot
    return { ...parsed, source: 'cache' }
  } catch {
    return null
  }
}

export async function writeReputation(snapshot: ReputationSnapshot): Promise<void> {
  try {
    await redis.setex(
      repKey(snapshot.chain, snapshot.address),
      REP_TTL_SEC,
      JSON.stringify({ ...snapshot, source: 'live' })
    )
  } catch {
    /* best-effort ledger — Redis optional */
  }
}

export function isReputationFresh(
  snapshot: ReputationSnapshot,
  maxAgeMs: number = REP_READ_FIRST_MAX_AGE_MS
): boolean {
  const updated = new Date(snapshot.updatedAt).getTime()
  if (!Number.isFinite(updated)) return false
  return Date.now() - updated >= 0 && Date.now() - updated < maxAgeMs
}
