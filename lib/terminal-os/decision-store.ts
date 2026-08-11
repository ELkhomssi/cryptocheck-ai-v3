/**
 * Server Decision store — Redis.
 * Keys: ccai:tos:decision:token:{id} · ccai:tos:decision:index · ccai:tos:decision:hist:{id}
 * Cron / decision tick writes; Layer 4 APIs only read.
 */

import 'server-only'

import type { Decision } from '@cryptocheck/decision-contracts'
import { redis } from '@/lib/cache/redis'

const TOKEN_PREFIX = 'ccai:tos:decision:token:'
const INDEX_KEY = 'ccai:tos:decision:index'
const HIST_PREFIX = 'ccai:tos:decision:hist:'
const TICK_META_KEY = 'ccai:tos:decision:tick:meta'
const TTL_SEC = 60 * 30
const HIST_TTL_SEC = 60 * 60 * 24 * 7

/** Last Decision Engine tick counts — real numbers only for Gateway spoken summary. */
export type DecisionTickMeta = {
  at: string
  /** Tokens considered from the live feed this cycle */
  scanned: number
  /** Canonical Decisions written this cycle */
  published: number
  /** Subset with action BUY */
  buyCount: number
  /** Subset with action WAIT or DO_NOTHING */
  waitCount: number
  /** Wallet used for DNA/portfolio when present */
  wallet?: string | null
  /** Count of open holdings mints for that wallet */
  openPositions?: number
}

export type DecisionHistoryPoint = {
  at: string
  action: Decision['action']
  confidence: number
  marketConfidence: number
  personalizedConfidence?: number
  confidenceMode: Decision['confidenceMode']
  risk: number
  reasoning: string
}

function tokenKey(id: string) {
  return `${TOKEN_PREFIX}${id}`
}

function histKey(id: string) {
  return `${HIST_PREFIX}${id}`
}

function subjectId(decision: Decision): string {
  if (!decision.subject) return decision.id
  return decision.subject.kind === 'token'
    ? decision.subject.address || decision.subject.symbol
    : decision.subject.address
}

async function appendHistory(id: string, decision: Decision): Promise<void> {
  const point: DecisionHistoryPoint = {
    at: decision.computedAt,
    action: decision.action,
    confidence: decision.confidence,
    marketConfidence: decision.marketConfidence,
    personalizedConfidence: decision.personalizedConfidence,
    confidenceMode: decision.confidenceMode,
    risk: decision.risk,
    reasoning: decision.reasoning?.slice?.(0, 240) ?? '',
  }
  const raw = await redis.get(histKey(id))
  let points: DecisionHistoryPoint[] = []
  if (raw) {
    try {
      points = JSON.parse(raw) as DecisionHistoryPoint[]
    } catch {
      points = []
    }
  }
  const last = points[points.length - 1]
  if (
    last &&
    last.action === point.action &&
    Math.abs(last.marketConfidence - point.marketConfidence) < 2
  ) {
    points[points.length - 1] = point
  } else {
    points.push(point)
  }
  await redis.setex(histKey(id), HIST_TTL_SEC, JSON.stringify(points.slice(-64)))
}

export async function saveDecision(decision: Decision): Promise<void> {
  const id = subjectId(decision)
  await redis.setex(tokenKey(id), TTL_SEC, JSON.stringify(decision))
  await appendHistory(id, decision)
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

export async function getDecisionHistory(id: string, limit = 32): Promise<DecisionHistoryPoint[]> {
  const raw = await redis.get(histKey(id))
  if (!raw) return []
  try {
    const points = JSON.parse(raw) as DecisionHistoryPoint[]
    return points.slice(-Math.max(1, Math.min(64, limit)))
  } catch {
    return []
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

export async function saveDecisionTickMeta(meta: DecisionTickMeta): Promise<void> {
  await redis.setex(TICK_META_KEY, TTL_SEC, JSON.stringify(meta))
}

export async function getDecisionTickMeta(): Promise<DecisionTickMeta | null> {
  const raw = await redis.get(TICK_META_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DecisionTickMeta
  } catch {
    return null
  }
}
