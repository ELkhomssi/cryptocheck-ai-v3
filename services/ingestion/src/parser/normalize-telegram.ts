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

/** Drop GramJS catch-up / historical replays so they never appear as live opportunities. */
const MAX_MSG_AGE_MS = Math.max(
  60_000,
  Number(process.env.SIGNAL_TELEGRAM_MAX_MSG_AGE_MS ?? 48 * 60 * 60 * 1000) || 48 * 60 * 60 * 1000,
)

function isStaleMessage(ts: string): boolean {
  const t = Date.parse(ts)
  if (!Number.isFinite(t)) return false
  return Date.now() - t > MAX_MSG_AGE_MS
}

function isResolvableAddress(chain: string, ca: string): boolean {
  if (chain === 'solana') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)) return false
    // News URLs often embed 32-char hex tracking IDs — not Solana mints.
    if (ca.length === 32 && /^[0-9a-f]+$/i.test(ca)) return false
    return true
  }
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

/** Debug: log every regex CA hit so we can see catch rate vs news-only channels. */
function logPotentialCa(raw: RawMessage, candidate: ParseCandidate | null, stage: string): void {
  if (!candidate?.contractAddress) return
  const ca = candidate.contractAddress
  console.info('[telegram:ca-hit]', {
    stage,
    channel: raw.channel,
    messageId: raw.messageId,
    chain: candidate.chain,
    ca: `${ca.slice(0, 8)}…${ca.slice(-4)}`,
    symbol: candidate.tokenSymbol,
    confidence: candidate.confidence,
    parseMethod: candidate.parseMethod,
    textPreview: (raw.text ?? '').replace(/\s+/g, ' ').slice(0, 120),
  })
}

export async function normalizeTelegramMessage(raw: RawMessage): Promise<UnifiedSignal | null> {
  if (raw.eventType === 'delete') {
    return deleteTombstone(raw)
  }

  // Catch-up getMessages() replays years-old posts — never XADD those as live signals.
  if (isStaleMessage(raw.ts)) {
    console.info('[telegram] drop stale message (outside freshness window)', {
      channel: raw.channel,
      messageId: raw.messageId,
      msgTimestamp: raw.ts,
      maxAgeMs: MAX_MSG_AGE_MS,
    })
    return null
  }

  const adapterHit = parseWithAdapter(raw)
  let candidate = adapterHit ?? parseWithRegex(raw)
  if (candidate) logPotentialCa(raw, candidate, adapterHit ? 'adapter' : 'regex')

  if (!candidate || candidate.confidence < LLM_CONFIDENCE_THRESHOLD) {
    const llm = await parseWithLlm(raw)
    if (llm) {
      candidate = llm
      markLlm()
      logPotentialCa(raw, candidate, 'llm')
    }
  }

  if (!candidate) return null
  if (!isResolvableAddress(candidate.chain, candidate.contractAddress)) {
    console.warn('[telegram:ca-hit] rejected — not resolvable address shape', {
      channel: raw.channel,
      chain: candidate.chain,
      ca: candidate.contractAddress,
    })
    return null
  }

  return candidateToUnified(raw, candidate)
}
