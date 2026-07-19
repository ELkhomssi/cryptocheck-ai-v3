/**
 * X/Twitter tweet → UnifiedSignal (same regex → adapter → LLM path as Telegram).
 */
import type { RawMessage, UnifiedSignal } from '@cryptocheck/signal-contracts'
import { namespacedSignalId } from '@cryptocheck/signal-contracts'
import { parseWithAdapter } from './adapters/registry.js'
import { parseWithLlm } from './llm-parser.js'
import { markLlm } from './stats.js'
import { parseWithRegex } from './regex-parser.js'
import type { ParseCandidate } from './types.js'

const LLM_CONFIDENCE_THRESHOLD = Number(process.env.SIGNAL_LLM_MIN_REGEX_CONFIDENCE ?? 0.7)

const MAX_MSG_AGE_MS = Math.max(
  60_000,
  Number(process.env.SIGNAL_TWITTER_MAX_MSG_AGE_MS ?? 48 * 60 * 60 * 1000) || 48 * 60 * 60 * 1000,
)

function isStaleMessage(ts: string): boolean {
  const t = Date.parse(ts)
  if (!Number.isFinite(t)) return false
  return Date.now() - t > MAX_MSG_AGE_MS
}

function isResolvableAddress(chain: string, ca: string): boolean {
  if (chain === 'solana') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)) return false
    if (ca.length === 32 && /^[0-9a-f]+$/i.test(ca)) return false
    return true
  }
  return /^0x[a-fA-F0-9]{40}$/.test(ca)
}

function candidateToUnified(raw: RawMessage, candidate: ParseCandidate): UnifiedSignal {
  const sourceRef = raw.messageId
  return {
    id: namespacedSignalId('twitter', sourceRef),
    sourceTag: 'twitter',
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
      platform: 'twitter',
    },
    sources: [raw.channel],
    sourceCount: 1,
  }
}

export async function normalizeTwitterMessage(raw: RawMessage): Promise<UnifiedSignal | null> {
  if (isStaleMessage(raw.ts)) {
    console.info('[twitter] drop stale tweet', {
      handle: raw.channel,
      tweetId: raw.messageId,
      msgTimestamp: raw.ts,
    })
    return null
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
  if (!isResolvableAddress(candidate.chain, candidate.contractAddress)) {
    console.warn('[twitter:ca-hit] rejected — not resolvable address shape', {
      handle: raw.channel,
      chain: candidate.chain,
      ca: candidate.contractAddress,
    })
    return null
  }

  console.info('[twitter:ca-hit]', {
    handle: raw.channel,
    tweetId: raw.messageId,
    chain: candidate.chain,
    ca: `${candidate.contractAddress.slice(0, 8)}…${candidate.contractAddress.slice(-4)}`,
    symbol: candidate.tokenSymbol,
  })

  return candidateToUnified(raw, candidate)
}
