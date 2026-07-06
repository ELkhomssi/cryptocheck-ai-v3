import {
  SIGNAL_CONSUMER_GROUP_ENRICH,
  SIGNAL_STREAM_PARSED,
  type ParsedStreamEntry,
} from '@cryptocheck/signal-contracts'
import { upstashCommand } from './redis-client.js'

export type ParsedStreamRecord = { id: string; entry: ParsedStreamEntry }

type ParsedStreamTuple = [string, [string, string[]][]]

function parseFields(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < fields.length; i += 2) {
    const k = fields[i]
    const v = fields[i + 1]
    if (k != null && v != null) out[k] = v
  }
  return out
}

function decodeParsedEntry(id: string, fields: string[]): ParsedStreamRecord | null {
  const data = parseFields(fields).data
  if (!data) return null
  try {
    return { id, entry: JSON.parse(data) as ParsedStreamEntry }
  } catch {
    return null
  }
}

export async function ensureEnrichConsumerGroup(): Promise<void> {
  try {
    await upstashCommand(
      'XGROUP',
      'CREATE',
      SIGNAL_STREAM_PARSED,
      SIGNAL_CONSUMER_GROUP_ENRICH,
      '0',
      'MKSTREAM',
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/BUSYGROUP/i.test(msg)) throw e
  }
}

export async function readParsedBatch(
  consumer: string,
  count: number,
  blockMs: number,
): Promise<ParsedStreamRecord[]> {
  const result = await upstashCommand<ParsedStreamTuple[] | null>(
    'XREADGROUP',
    'GROUP',
    SIGNAL_CONSUMER_GROUP_ENRICH,
    consumer,
    'COUNT',
    count,
    'BLOCK',
    blockMs,
    'STREAMS',
    SIGNAL_STREAM_PARSED,
    '>',
  )

  if (!result?.length) return []

  const rows: ParsedStreamRecord[] = []
  for (const [, messages] of result) {
    for (const [id, fields] of messages) {
      const row = decodeParsedEntry(id, fields)
      if (row) rows.push(row)
    }
  }
  return rows
}

export async function ackParsedEntries(ids: string[]): Promise<void> {
  if (!ids.length) return
  await upstashCommand('XACK', SIGNAL_STREAM_PARSED, SIGNAL_CONSUMER_GROUP_ENRICH, ...ids)
}
