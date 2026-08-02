/**
 * Attention Feed Redis store — precomputed live state for Simple Mode.
 * Keys: ccai:tos:attention:*
 * Cron / workers write; SSE clients only read.
 */

import { redis } from '@/lib/cache/redis'
import type { AttentionItem } from '@/features/attention-feed/types'

const FEED_KEY = 'ccai:tos:attention:feed'
const FP_KEY = 'ccai:tos:attention:fingerprints'
const SEQ_KEY = 'ccai:tos:attention:seq'
const EVENTS_KEY = 'ccai:tos:attention:events'
const TTL_SEC = 60 * 60 * 6

export type AttentionChangeKind = 'new' | 'updated'

export type AttentionLiveEvent = {
  seq: number
  kind: AttentionChangeKind
  eventType:
    | 'MarketContextChanged'
    | 'SecurityFlagRaised'
    | 'PortfolioChanged'
    | 'DecisionMade'
    | 'DNAUpdated'
    | 'WhaleFlow'
  itemId: string
  at: string
}

export type AttentionFeedSnapshot = {
  items: AttentionItem[]
  seq: number
  updatedAt: string
  events: AttentionLiveEvent[]
}

export async function getAttentionSnapshot(): Promise<AttentionFeedSnapshot | null> {
  const raw = await redis.get(FEED_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AttentionFeedSnapshot
  } catch {
    return null
  }
}

export async function getAttentionFingerprints(): Promise<Record<string, string>> {
  const raw = await redis.get(FP_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

export async function saveAttentionSnapshot(
  items: AttentionItem[],
  fingerprints: Record<string, string>,
  newEvents: Omit<AttentionLiveEvent, 'seq'>[],
): Promise<AttentionFeedSnapshot> {
  const prev = await getAttentionSnapshot()
  let seq = prev?.seq ?? 0
  const events: AttentionLiveEvent[] = [...(prev?.events ?? [])]
  for (const e of newEvents) {
    seq += 1
    events.unshift({ ...e, seq })
  }
  const snapshot: AttentionFeedSnapshot = {
    items,
    seq,
    updatedAt: new Date().toISOString(),
    events: events.slice(0, 48),
  }
  await redis.setex(FEED_KEY, TTL_SEC, JSON.stringify(snapshot))
  await redis.setex(FP_KEY, TTL_SEC, JSON.stringify(fingerprints))
  await redis.setex(SEQ_KEY, TTL_SEC, String(seq))
  await redis.setex(EVENTS_KEY, TTL_SEC, JSON.stringify(snapshot.events))
  return snapshot
}

export async function getAttentionSeq(): Promise<number> {
  const v = await redis.get(SEQ_KEY)
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Content fingerprint — material fields only (ignores pure timestamp noise). */
export function attentionFingerprint(item: AttentionItem): string {
  // Coach Decision messages: id embeds action+confidence so DecisionMade changes
  // fingerprint as new items when those fields change.
  return [
    item.id.startsWith('coach:decision:') ? item.id : '',
    item.sourceEngine,
    item.urgency,
    item.headline,
    item.recommendation?.action ?? '',
    item.recommendation?.confidence ?? '',
    Math.round(item.rankScore / 5) * 5,
  ].join('|')
}
