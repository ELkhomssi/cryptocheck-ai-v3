import { randomUUID } from 'node:crypto'
import { SIGNAL_LATENCY_CONTRACT } from '@cryptocheck/signal-contracts'
import type { NormalizedSignal } from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'
import type { ParseCandidate } from './types.js'

const DEDUP_PREFIX = 'ccai:sig:dedup:'
const MSGMAP_PREFIX = 'ccai:sig:msgmap:'
const DEDUP_TTL_SEC = SIGNAL_LATENCY_CONTRACT.dedupWindowSec
const MSGMAP_TTL_SEC = 60 * 60 * 24 * 7

type DedupRecord = {
  id: string
  sources: string[]
  sourceCount: number
}

function dedupKey(candidate: ParseCandidate): string {
  const ca = candidate.contractAddress.toLowerCase()
  return `${DEDUP_PREFIX}${candidate.chain}:${ca}:${candidate.signalType}`
}

function msgMapKey(channel: string, messageId: string): string {
  return `${MSGMAP_PREFIX}${channel}:${messageId}`
}

export type DedupResult = {
  signal: NormalizedSignal
  update: boolean
}

export async function applyDedup(
  redis: Redis,
  raw: {
    channel: string
    messageId: string
    text: string
    msgTimestamp: string
    ingestTimestamp: string
  },
  candidate: ParseCandidate,
): Promise<DedupResult> {
  const key = dedupKey(candidate)
  const existingRaw = await redis.get<string>(key)
  let record: DedupRecord | null = null
  if (existingRaw) {
    try {
      record = JSON.parse(existingRaw) as DedupRecord
    } catch {
      record = null
    }
  }

  const sources = new Set(record?.sources ?? [])
  sources.add(raw.channel)
  const sourceCount = sources.size
  const id = record?.id ?? `sig_${randomUUID()}`
  const update = record != null

  const signal: NormalizedSignal = {
    id,
    sourceChannel: raw.channel,
    sourceMessageId: raw.messageId,
    chain: candidate.chain,
    contractAddress: candidate.contractAddress,
    tokenSymbol: candidate.tokenSymbol,
    pair: candidate.pair,
    price: candidate.price,
    signalType: candidate.signalType,
    confidence: candidate.confidence,
    parseMethod: candidate.parseMethod,
    rawText: raw.text,
    msgTimestamp: raw.msgTimestamp,
    ingestTimestamp: raw.ingestTimestamp,
    resolved: false,
    sentinelVerdict: 'scanning',
    sources: [...sources],
    sourceCount,
  }

  const next: DedupRecord = { id, sources: signal.sources, sourceCount }
  await redis.set(key, JSON.stringify(next), { ex: DEDUP_TTL_SEC })
  await redis.set(msgMapKey(raw.channel, raw.messageId), id, { ex: MSGMAP_TTL_SEC })

  return { signal, update }
}

export async function resolveSignalIdForMessage(
  redis: Redis,
  channel: string,
  messageId: string,
): Promise<string | null> {
  const v = await redis.get<string>(msgMapKey(channel, messageId))
  return typeof v === 'string' ? v : null
}

export async function clearMessageMap(
  redis: Redis,
  channel: string,
  messageId: string,
): Promise<void> {
  await redis.del(msgMapKey(channel, messageId))
}
