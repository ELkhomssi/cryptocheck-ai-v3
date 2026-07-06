import {
  SIGNAL_CONSUMER_GROUP_GATE,
  SIGNAL_STREAM_UNIFIED,
  SIGNAL_UNIFIED_STREAM_FIELD,
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

export async function ensureGateConsumerGroup(): Promise<void> {
  try {
    await upstashCommand(
      'XGROUP',
      'CREATE',
      SIGNAL_STREAM_UNIFIED,
      SIGNAL_CONSUMER_GROUP_GATE,
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
    SIGNAL_CONSUMER_GROUP_GATE,
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

export async function ackUnifiedEntries(ids: string[]): Promise<void> {
  if (!ids.length) return
  await upstashCommand('XACK', SIGNAL_STREAM_UNIFIED, SIGNAL_CONSUMER_GROUP_GATE, ...ids)
}
