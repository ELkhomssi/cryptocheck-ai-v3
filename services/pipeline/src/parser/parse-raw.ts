import type { RawMessage } from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'
import { parseWithAdapter } from './adapters/registry.js'
import { applyDedup, clearMessageMap, resolveSignalIdForMessage } from './dedup.js'
import { parseWithLlm } from './llm-parser.js'
import { markLlm } from './stats.js'
import { parseWithRegex } from './regex-parser.js'
import type { ParsedStreamEntry } from '@cryptocheck/signal-contracts'

const LLM_CONFIDENCE_THRESHOLD = Number(process.env.SIGNAL_LLM_MIN_REGEX_CONFIDENCE ?? 0.7)

function isResolvableAddress(chain: string, ca: string): boolean {
  if (chain === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)
  return /^0x[a-fA-F0-9]{40}$/.test(ca)
}

export async function processRawMessage(redis: Redis, raw: RawMessage): Promise<ParsedStreamEntry[]> {
  if (raw.eventType === 'delete') {
    const signalId = await resolveSignalIdForMessage(redis, raw.channel, raw.messageId)
    await clearMessageMap(redis, raw.channel, raw.messageId)
    return [
      {
        kind: 'remove',
        channel: raw.channel,
        messageId: raw.messageId,
        signalId: signalId ?? undefined,
      },
    ]
  }

  const adapterHit = parseWithAdapter(raw)
  let candidate = adapterHit ?? parseWithRegex(raw)

  if (!candidate || candidate.confidence < LLM_CONFIDENCE_THRESHOLD) {
    const llm = await parseWithLlm(raw)
    if (llm) {
      candidate = llm
      markLlm()
    }
  }

  if (!candidate) return []
  if (!isResolvableAddress(candidate.chain, candidate.contractAddress)) return []

  const { signal, update } = await applyDedup(redis, {
    channel: raw.channel,
    messageId: raw.messageId,
    text: raw.text,
    msgTimestamp: raw.ts,
    ingestTimestamp: raw.ingestTs,
  }, candidate)

  return [{ kind: 'signal', signal, update: raw.eventType === 'edit' || update }]
}
