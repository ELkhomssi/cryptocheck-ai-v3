/**
 * Server Decision store — Redis.
 * Keys: ccai:tos:decision:token:{id} · ccai:tos:decision:index
 * Cron / decision tick writes; Layer 4 APIs only read.
 */

import 'server-only'

import type { Decision } from '@cryptocheck/decision-contracts'
import { redis } from '@/lib/cache/redis'

const TOKEN_PREFIX = 'ccai:tos:decision:token:'
const INDEX_KEY = 'ccai:tos:decision:index'
const TTL_SEC = 60 * 30

function tokenKey(id: string) {
  return `${TOKEN_PREFIX}${id}`
}

export async function saveDecision(decision: Decision): Promise<void> {
  const id =
    decision.subject.kind === 'token'
      ? decision.subject.address || decision.subject.symbol
      : decision.subject.address
  await redis.setex(tokenKey(id), TTL_SEC, JSON.stringify(decision))
  const raw = await redis.get(INDEX_KEY)
  let ids: string[] = []
  if (raw) {
    try {
      ids = JSON.parse(raw) as string[]
    } catch {
      ids = []
    }
  }
  ids = [id, ...ids.filter((x) => x !== id)].slice(0, 48)
  await redis.setex(INDEX_KEY, TTL_SEC, JSON.stringify(ids))
}

export async function getDecisionByTokenId(id: string): Promise<Decision | null> {
  const raw = await redis.get(tokenKey(id))
  if (!raw) return null
  try {
    return JSON.parse(raw) as Decision
  } catch {
    return null
  }
}

export async function listRecentDecisions(limit = 16): Promise<Decision[]> {
  const raw = await redis.get(INDEX_KEY)
  if (!raw) return []
  let ids: string[] = []
  try {
    ids = JSON.parse(raw) as string[]
  } catch {
    return []
  }
  const out: Decision[] = []
  for (const id of ids.slice(0, limit)) {
    const d = await getDecisionByTokenId(id)
    if (d) out.push(d)
  }
  return out
}

export async function getDecisionIndexIds(): Promise<string[]> {
  const raw = await redis.get(INDEX_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}
