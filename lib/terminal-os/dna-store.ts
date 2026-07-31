/**
 * Persist TraderDNA per wallet — coach + multi-instance share the same profile.
 * Keys: ccai:tos:dna:{wallet}
 */
import 'server-only'

import { redis } from '@/lib/cache/redis'
import type { TraderDna } from '@/features/terminal-os/ai-trade-like-me/types'

const PREFIX = 'ccai:tos:dna:'
const TTL_SEC = 60 * 60 * 24 * 90

function key(wallet: string) {
  return `${PREFIX}${wallet}`
}

export async function getPersistedDna(wallet: string): Promise<TraderDna | null> {
  try {
    const raw = await redis.get(key(wallet))
    if (!raw) return null
    const parsed = JSON.parse(raw) as TraderDna
    if (!parsed?.wallet || typeof parsed.sampleSize !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export async function savePersistedDna(dna: TraderDna): Promise<void> {
  await redis.setex(key(dna.wallet), TTL_SEC, JSON.stringify(dna))
}

export async function clearPersistedDna(wallet: string): Promise<void> {
  try {
    await redis.del(key(wallet))
  } catch {
    /* best-effort */
  }
}
