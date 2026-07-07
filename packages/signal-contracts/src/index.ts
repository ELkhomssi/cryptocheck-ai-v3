/**
 * Signal Aggregator — end-to-end contracts.
 * Keep FeeRecord in sync with lib/revenue-dashboard/types.ts (swap product ledger).
 *
 * Legacy Telegram path: RawMessage → NormalizedSignal (ccai:sig:stream:raw|parsed).
 * Multi-source path (Prompt 0+): SourceAdapter → UnifiedSignal (ccai:sig:stream:unified).
 */

export * from './unified-ingestion.js'
export * from './edge-signal.js'
export * from './agent.js'
export * from './proof.js'
export * from './service-heartbeat.js'
export * from './token-call.js'
export * from './scanner.js'
import type { SourceTag, SubjectType, UnifiedFeedEvent } from './unified-ingestion.js'
export type SignalChain = 'solana' | 'ethereum' | 'base' | 'bsc' | 'arbitrum'

export type SignalType = 'buy' | 'sell' | 'mention'

export type ParseMethod = 'regex' | 'adapter' | 'llm'

/** Sentinel gate verdict surfaced in the Master Feed (lowercase for UI chips). */
export type SentinelVerdict = 'scanning' | 'safe' | 'caution' | 'danger'

export type RawMessageEventType = 'new' | 'edit' | 'delete'

/**
 * Ingestion queue envelope — written to Redis Stream immediately; never blocks on parsing.
 */
export type RawMessage = {
  /** Public Telegram channel username or numeric id (attribution). */
  channel: string
  messageId: string
  text: string
  /** Opaque GramJS entities payload (links, mentions) — JSON-serializable. */
  entities: unknown[]
  eventType: RawMessageEventType
  /** Source message timestamp (ISO 8601). */
  ts: string
  /** Ingest wall-clock (ISO 8601). */
  ingestTs: string
}

/**
 * Normalized signal — produced by pipeline, enriched async, pushed to Master Feed.
 */
export type NormalizedSignal = {
  id: string
  sourceChannel: string
  sourceMessageId: string
  chain: SignalChain
  contractAddress: string
  tokenSymbol: string
  pair?: string
  price?: number
  signalType: SignalType
  /** Parser confidence 0–1. */
  confidence: number
  parseMethod: ParseMethod
  rawText: string
  msgTimestamp: string
  ingestTimestamp: string
  /** True after on-chain resolve + Sentinel complete. */
  resolved: boolean
  sentinelVerdict: SentinelVerdict
  /** Gateway / Sentinel safety score 0–100 when resolved. */
  neuralScore?: number
  /** Deduped source channels (same CA + signalType within window). */
  sources: string[]
  sourceCount: number
  /** When true, UI MUST show a visible "sample" tag — never present as live data. */
  sample?: boolean
  /** Set when enrichment drops or flags an unresolvable CA. */
  dropped?: boolean
  dropReason?: string
}

/** Parser → enrich queue envelope (field `data` on ccai:sig:stream:parsed). */
export type ParsedStreamEntry =
  | { kind: 'signal'; signal: NormalizedSignal; update: boolean }
  | { kind: 'remove'; channel: string; messageId: string; signalId?: string }

/**
 * Persisted fee ledger row — reuse from swap product (revenue dashboard).
 * Keep in sync with lib/revenue-dashboard/types.ts FeeRecord.
 */
export type FeeRecord = {
  id: string
  signature: string
  walletAddress: string
  inputMint: string
  outputMint: string
  volumeUsd: number
  feeBps: number
  feeAmountBase: string
  feeAmountUsd?: number
  feeTokenAccount: string
  executedAt: string
  humanWalletHeuristic?: 'likely_human' | 'likely_bot' | 'unknown'
  /** Optional link back to the signal that initiated the swap. */
  signalId?: string
}

/** Redis Stream keys (repo naming: ccai:sig:*). */
export const SIGNAL_STREAM_RAW = 'ccai:sig:stream:raw'
export const SIGNAL_STREAM_PARSED = 'ccai:sig:stream:parsed'
export const SIGNAL_CONSUMER_GROUP_PARSER = 'ccai:sig:cg:parser'
export const SIGNAL_CONSUMER_GROUP_ENRICH = 'ccai:sig:cg:enrich'

/** Redis pub/sub channel for realtime gateway (new + update events). */
export const SIGNAL_PUBSUB_CHANNEL = 'ccai:sig:pub:feed'

/** Durable feed stream for WS gateway (Upstash REST has no SUBSCRIBE). */
export const SIGNAL_STREAM_FEED = 'ccai:sig:stream:feed'

/** Redis cache key for latest-N feed snapshot. */
export const SIGNAL_FEED_CACHE_KEY = 'ccai:sig:cache:feed:latest'

/**
 * Realtime gateway → client event types.
 * Multi-source path publishes UnifiedSignal (token + match_event).
 * Legacy enrich may still emit token-shaped UnifiedSignals.
 */
export type SignalFeedEvent = UnifiedFeedEvent

/** WebSocket subscription filter (enforced server-side; Prompt 4 adds UI source chips). */
export type SignalFeedFilter = {
  minVerdict?: Exclude<SentinelVerdict, 'scanning'>
  minSourceCount?: number
  chain?: SignalChain
  minLiquidityUsd?: number
  search?: string
  sourceTag?: SourceTag | 'all'
  subjectType?: SubjectType
}

/** Freemium tier — enforced at realtime gateway (Prompt 4/6). */
export type SignalSubscriptionTier = 'free' | 'premium'

export const SIGNAL_LATENCY_CONTRACT = {
  /** Ingestion: XADD only; no parser calls on hot path. */
  ingestMaxBlockingMs: 50,
  /** Parser fast-path regex target. */
  parseRegexTargetMs: 5,
  /** Time to first feed row after parse (verdict=scanning). */
  feedFirstPaintTargetMs: 200,
  /** Sentinel async-upgrade SLA (P50). */
  sentinelUpgradeTargetMs: 1500,
  /** WS gateway burst coalesce window. */
  wsCoalesceMsMin: 250,
  wsCoalesceMsMax: 500,
  /** Dedup window for cross-channel collapse. */
  dedupWindowSec: 120,
} as const

export const SIGNAL_COMPLIANCE = {
  disclaimer: 'Not financial advice · DYOR',
  signalLabel: 'Informational signal — not an endorsement',
  /** Sports / match_event rows — never swap recommendations. */
  sportsLabel: 'Sports signals are informational only — not swap recommendations',
  termsPath: '/legal/terms',
  feeDisclosurePath: '/legal/fees',
} as const
