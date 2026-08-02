/**
 * Capital rotation event store — Redis.
 * Keys: ccai:tos:rotation:events:{wallet} · ccai:tos:rotation:threshold:{wallet}
 * · ccai:tos:rotation:proposal:{wallet}
 */

import 'server-only'

import { redis } from '@/lib/cache/redis'
import type {
  RotationEvent,
  RotationProposal,
  RotationThreshold,
} from '@/features/terminal-os/capital-rotation/types'
import { computeRotationAggregate } from '@/features/terminal-os/capital-rotation/logic'

export type {
  RotationAggregateStats,
  RotationEvent,
  RotationPermissionMode,
  RotationProposal,
  RotationThreshold,
} from '@/features/terminal-os/capital-rotation/types'
export { DEFAULT_LOSS_THRESHOLD_PCT } from '@/features/terminal-os/capital-rotation/types'
export { computeRotationAggregate }

const EVENTS_PREFIX = 'ccai:tos:rotation:events:'
const THRESHOLD_PREFIX = 'ccai:tos:rotation:threshold:'
const PROPOSAL_PREFIX = 'ccai:tos:rotation:proposal:'
const TTL_EVENTS = 60 * 60 * 24 * 90
const TTL_PROPOSAL = 60 * 60 * 6

function eventsKey(wallet: string) {
  return `${EVENTS_PREFIX}${wallet}`
}
function thresholdKey(wallet: string) {
  return `${THRESHOLD_PREFIX}${wallet}`
}
function proposalKey(wallet: string) {
  return `${PROPOSAL_PREFIX}${wallet}`
}

export async function getRotationThreshold(wallet: string): Promise<RotationThreshold | null> {
  const raw = await redis.get(thresholdKey(wallet))
  if (!raw) return null
  try {
    return JSON.parse(raw) as RotationThreshold
  } catch {
    return null
  }
}

export async function saveRotationThreshold(t: RotationThreshold): Promise<void> {
  await redis.setex(thresholdKey(t.wallet), TTL_EVENTS, JSON.stringify(t))
}

export async function getRotationProposal(wallet: string): Promise<RotationProposal | null> {
  const raw = await redis.get(proposalKey(wallet))
  if (!raw) return null
  try {
    return JSON.parse(raw) as RotationProposal
  } catch {
    return null
  }
}

export async function saveRotationProposal(p: RotationProposal): Promise<void> {
  await redis.setex(proposalKey(p.wallet), TTL_PROPOSAL, JSON.stringify(p))
}

export async function clearRotationProposal(wallet: string): Promise<void> {
  await redis.del(proposalKey(wallet))
}

export async function appendRotationEvent(event: RotationEvent): Promise<void> {
  const raw = await redis.get(eventsKey(event.wallet))
  let list: RotationEvent[] = []
  if (raw) {
    try {
      list = JSON.parse(raw) as RotationEvent[]
    } catch {
      list = []
    }
  }
  list = [event, ...list.filter((e) => e.id !== event.id)].slice(0, 100)
  await redis.setex(eventsKey(event.wallet), TTL_EVENTS, JSON.stringify(list))
}

export async function listRotationEvents(wallet: string, limit = 24): Promise<RotationEvent[]> {
  const raw = await redis.get(eventsKey(wallet))
  if (!raw) return []
  try {
    return (JSON.parse(raw) as RotationEvent[]).slice(0, limit)
  } catch {
    return []
  }
}
