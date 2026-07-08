import {
  SIGNAL_CONSUMER_GROUP_SNIPER,
  SIGNAL_SNIPE_CANDIDATES_STREAM,
  SIGNAL_SNIPE_PUBSUB_CHANNEL,
  SIGNAL_STREAM_UNIFIED,
  SIGNAL_UNIFIED_STREAM_FIELD,
  SNIPE_STREAM_FIELD,
  type SnipeCandidate,
  type UnifiedSignal,
} from '@cryptocheck/signal-contracts'
import { upstashCommand } from './redis-client.js'

export type UnifiedStreamRecord = { id: string; signal: UnifiedSignal }

type StreamTuple = [string, [string, string[]][]]

function parseFields(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < fields.length; i += 2) {
    const k = fields[i]
    const v = fields[i + 1]
    if (k != null && v != null) out[k] = v
  }
  return out
}

function decodeEntry(id: string, fields: string[]): UnifiedStreamRecord | null {
  const data = parseFields(fields)[SIGNAL_UNIFIED_STREAM_FIELD]
  if (!data) return null
  try {
    return { id, signal: JSON.parse(data) as UnifiedSignal }
  } catch {
    return null
  }
}

/** Independent consumer group so the sniper sees every unified signal. */
export async function ensureSniperConsumerGroup(): Promise<void> {
  try {
    await upstashCommand(
      'XGROUP',
      'CREATE',
      SIGNAL_STREAM_UNIFIED,
      SIGNAL_CONSUMER_GROUP_SNIPER,
      '0',
      'MKSTREAM',
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/BUSYGROUP/i.test(msg)) throw e
  }
}

export async function readUnifiedBatch(
  consumer: string,
  count: number,
  blockMs: number,
): Promise<UnifiedStreamRecord[]> {
  const result = await upstashCommand<StreamTuple[] | null>(
    'XREADGROUP',
    'GROUP',
    SIGNAL_CONSUMER_GROUP_SNIPER,
    consumer,
    'COUNT',
    count,
    'BLOCK',
    blockMs,
    'STREAMS',
    SIGNAL_STREAM_UNIFIED,
    '>',
  )
  if (!result?.length) return []

  const rows: UnifiedStreamRecord[] = []
  for (const [, messages] of result) {
    for (const [id, fields] of messages) {
      const row = decodeEntry(id, fields)
      if (row) rows.push(row)
    }
  }
  return rows
}

export async function ackEntries(ids: string[]): Promise<void> {
  if (!ids.length) return
  await upstashCommand('XACK', SIGNAL_STREAM_UNIFIED, SIGNAL_CONSUMER_GROUP_SNIPER, ...ids)
}

/** Emit a vetted candidate to the durable stream + low-latency pub/sub. */
export async function emitCandidate(candidate: SnipeCandidate): Promise<void> {
  const payload = JSON.stringify(candidate)
  await upstashCommand(
    'XADD',
    SIGNAL_SNIPE_CANDIDATES_STREAM,
    'MAXLEN',
    '~',
    '5000',
    '*',
    SNIPE_STREAM_FIELD,
    payload,
  )
  await upstashCommand('PUBLISH', SIGNAL_SNIPE_PUBSUB_CHANNEL, payload)
}
