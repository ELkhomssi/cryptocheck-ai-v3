import {
  SIGNAL_CONSUMER_GROUP_PARSER,
  SIGNAL_STREAM_RAW,
  type RawMessage,
} from '@cryptocheck/signal-contracts'
import { createRedis, upstashCommand } from './redis-client.js'

export type StreamEntry = { id: string; message: RawMessage }

type RawStreamTuple = [string, [string, string[]][]]

function parseFields(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < fields.length; i += 2) {
    const k = fields[i]
    const v = fields[i + 1]
    if (k != null && v != null) out[k] = v
  }
  return out
}

function decodeEntry(id: string, fields: string[]): StreamEntry | null {
  const map = parseFields(fields)
  const data = map.data
  if (!data) return null
  try {
    return { id, message: JSON.parse(data) as RawMessage }
  } catch {
    return null
  }
}

export async function ensureParserConsumerGroup(): Promise<void> {
  try {
    await upstashCommand(
      'XGROUP',
      'CREATE',
      SIGNAL_STREAM_RAW,
      SIGNAL_CONSUMER_GROUP_PARSER,
      '0',
      'MKSTREAM',
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/BUSYGROUP/i.test(msg)) throw e
  }
}

export async function readRawBatch(
  consumer: string,
  count: number,
  blockMs: number,
): Promise<StreamEntry[]> {
  const result = await upstashCommand<RawStreamTuple[] | null>(
    'XREADGROUP',
    'GROUP',
    SIGNAL_CONSUMER_GROUP_PARSER,
    consumer,
    'COUNT',
    count,
    'BLOCK',
    blockMs,
    'STREAMS',
    SIGNAL_STREAM_RAW,
    '>',
  )

  if (!result?.length) return []

  const entries: StreamEntry[] = []
  for (const [, messages] of result) {
    for (const [id, fields] of messages) {
      const row = decodeEntry(id, fields)
      if (row) entries.push(row)
    }
  }
  return entries
}

export async function ackRawEntries(ids: string[]): Promise<void> {
  if (!ids.length) return
  await upstashCommand('XACK', SIGNAL_STREAM_RAW, SIGNAL_CONSUMER_GROUP_PARSER, ...ids)
}
