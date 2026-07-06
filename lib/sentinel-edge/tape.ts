import {
  SIGNAL_STREAM_AGENT,
  type AgentFeedEvent,
  type Decision,
  type Settlement,
} from '@cryptocheck/signal-contracts'
import { getAgentRedis } from './redis'

export type TapeEntry = {
  streamId: string
  event: AgentFeedEvent
  at: string
}

function parseEvent(raw: unknown): AgentFeedEvent | null {
  try {
    const data =
      typeof raw === 'string'
        ? (JSON.parse(raw) as AgentFeedEvent)
        : (raw as AgentFeedEvent)
    if (!data || typeof data !== 'object' || !('type' in data)) return null
    return data
  } catch {
    return null
  }
}

/** Latest agent events from Redis stream (newest first). */
export async function readAgentTape(limit = 50): Promise<TapeEntry[]> {
  const redis = getAgentRedis()
  if (!redis) return []

  const rows = (await redis.xrevrange(SIGNAL_STREAM_AGENT, '+', '-', limit)) as Record<
    string,
    { data?: string }
  >

  const out: TapeEntry[] = []
  for (const [streamId, fields] of Object.entries(rows ?? {})) {
    const ev = parseEvent(fields?.data)
    if (!ev) continue
    const at =
      ev.type === 'agent.decision'
        ? ev.decision.timestamp
        : ev.type === 'agent.settlement'
          ? ev.settlement.settledAt
          : ev.standDown.timestamp
    out.push({ streamId, event: ev, at })
  }
  return out
}

export function decisionsFromTape(tape: TapeEntry[]): Decision[] {
  return tape
    .filter((t) => t.event.type === 'agent.decision')
    .map((t) => (t.event as { type: 'agent.decision'; decision: Decision }).decision)
}

export function settlementsFromTape(tape: TapeEntry[]): Settlement[] {
  return tape
    .filter((t) => t.event.type === 'agent.settlement')
    .map((t) => (t.event as { type: 'agent.settlement'; settlement: Settlement }).settlement)
}
