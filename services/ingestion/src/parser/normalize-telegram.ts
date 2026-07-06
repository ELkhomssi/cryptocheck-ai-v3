/**
 * Telegram message → UnifiedSignal (regex → adapter → LLM).
 * Moved from services/pipeline/src/parser/parse-raw.ts (Prompt 1).
 */
import type { RawMessage, UnifiedSignal } from '@cryptocheck/signal-contracts'
import { namespacedSignalId } from '@cryptocheck/signal-contracts'
import { parseWithAdapter } from './adapters/registry.js'
import { parseWithLlm } from './llm-parser.js'
import { markLlm } from './stats.js'
import { parseWithRegex } from './regex-parser.js'
import type { ParseCandidate } from './types.js'

const LLM_CONFIDENCE_THRESHOLD = Number(process.env.SIGNAL_LLM_MIN_REGEX_CONFIDENCE ?? 0.7)

function isResolvableAddress(chain: string, ca: string): boolean {
  if (chain === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)
  return /^0x[a-fA-F0-9]{40}$/.test(ca)
}

function candidateToUnified(raw: RawMessage, candidate: ParseCandidate): UnifiedSignal {
  const sourceRef = raw.messageId
  return {
    id: namespacedSignalId('telegram', sourceRef),
    sourceTag: 'telegram',
    sourceRef,
    subjectType: 'token',
    label: candidate.tokenSymbol,
    type: candidate.signalType,
    value: candidate.price,
    msgTimestamp: raw.ts,
    ingestTimestamp: raw.ingestTs,
    confidence: candidate.confidence,
    chain: candidate.chain,
    contractAddress: candidate.contractAddress,
    tokenSymbol: candidate.tokenSymbol,
    verdict: 'scanning',
    rawPayload: {
      channel: raw.channel,
      text: raw.text,
      entities: raw.entities,
      eventType: raw.eventType,
      parseMethod: candidate.parseMethod,
      pair: candidate.pair,
    },
    sources: [raw.channel],
    sourceCount: 1,
  }
}

function deleteTombstone(raw: RawMessage): UnifiedSignal {
  const sourceRef = raw.messageId
  return {
    id: namespacedSignalId('telegram', sourceRef),
    sourceTag: 'telegram',
    sourceRef,
    subjectType: 'token',
    label: '—',
    type: 'mention',
    msgTimestamp: raw.ts,
    ingestTimestamp: raw.ingestTs,
    confidence: 1,
    verdict: 'n/a',
    dropped: true,
    dropReason: 'message_deleted',
    rawPayload: {
      channel: raw.channel,
      eventType: 'delete',
    },
    sources: [raw.channel],
    sourceCount: 1,
  }
}

export async function normalizeTelegramMessage(raw: RawMessage): Promise<UnifiedSignal | null> {
  if (raw.eventType === 'delete') {
    return deleteTombstone(raw)
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

  if (!candidate) return null
  if (!isResolvableAddress(candidate.chain, candidate.contractAddress)) return null

  return candidateToUnified(raw, candidate)
}
