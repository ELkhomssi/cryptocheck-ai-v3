/**
 * Multi-Source Ingestion Engine — contracts (Prompt 0).
 * Telegram + TxODDS (+ future) → one unified queue → source-aware gate → agnostic feed.
 *
 * COLLISION / SCALE STRATEGY
 * ─────────────────────────
 * 1. Namespaced ids: `${sourceTag}:${sourceRef}` — no cross-source key collisions.
 * 2. DB idempotency: UNIQUE (source_tag, source_ref) on signal_normalized.
 * 3. Unified Redis Stream + consumer group — each event processed exactly once; workers scale horizontally.
 * 4. Burst isolation: per-source ingress streams (`ccai:sig:stream:source:{tag}`) fan in to unified stream;
 *    per-source MAXLEN trim + optional rate limits so one noisy source cannot starve another.
 * 5. Parse-time dedup: Redis SETNX on `ccai:sig:dedup:id:{id}` before XADD (TTL ≈ dedup window).
 *
 * Downstream (feed, swap execution) is source-agnostic. Source-specific logic lives ONLY in adapters
 * and in the gate's internal dispatch (token → scan gateway; match_event → SportsSignalEvaluator).
 */

import type { EdgeSignal } from './edge-signal.js'

/** Registered ingestion sources. Extend via new SourceAdapter implementations only. */
export type SourceTag = 'telegram' | 'txodds'

/** Discriminator for gate dispatch + polymorphic Master Feed rows. */
export type SubjectType = 'token' | 'match_event'

/** Crypto signal kinds (Telegram). */
export type TokenEventType = 'buy' | 'sell' | 'mention'

/** Live sports event kinds (TxODDS). Extend as API surface grows. */
export type MatchEventType =
  | 'goal'
  | 'red_card'
  | 'yellow_card'
  | 'odds_shift'
  | 'back'
  | 'lay'
  | 'score_change'
  | 'kickoff'
  | 'full_time'

export type UnifiedEventType = TokenEventType | MatchEventType | string

/** Gate + feed verdict — superset includes sports N/A. */
export type UnifiedVerdict = 'scanning' | 'safe' | 'caution' | 'danger' | 'n/a'

export type MatchTeams = { home: string; away: string }
export type MatchScore = { home: number; away: number }

/**
 * Unified signal envelope — superset for crypto tokens and sports match events.
 * Written to the unified Redis Stream by adapters after normalize; enriched by the gate.
 */
export type UnifiedSignal = {
  /** Namespaced: `${sourceTag}:${sourceRef}` — global dedup / cache key. */
  id: string
  sourceTag: SourceTag
  /** Source-native id (Telegram message id, or `${matchId}:${eventSeq}`). */
  sourceRef: string
  subjectType: SubjectType
  /** Token symbol OR "ARG vs FRA". */
  label: string
  type: UnifiedEventType
  /** Crypto: price · sports: odds (when applicable). */
  value?: number
  msgTimestamp: string
  ingestTimestamp: string
  /** Parser / adapter confidence 0–1. */
  confidence: number

  // ── crypto-only (optional) ──
  chain?: string
  contractAddress?: string
  tokenSymbol?: string

  // ── sports-only (optional) ──
  matchId?: string
  teams?: MatchTeams
  score?: MatchScore
  market?: string

  // ── enrichment (gate fills; adapters emit scanning / defaults) ──
  verdict: UnifiedVerdict
  /** Neural score (token) or edge magnitude 0–100 (sports). */
  scoreValue?: number
  /** Sports only — explainable edge from SportsSignalEvaluator (Prompt A). */
  edgeSignal?: EdgeSignal
  rawPayload: Record<string, unknown>
  sources?: string[]
  sourceCount?: number

  /** Visible sample tag — never present as live production data. */
  sample?: boolean
  dropped?: boolean
  dropReason?: string
}

/**
 * Every ingestion source implements this interface.
 * Adapters are the ONLY place for source-specific connection, parsing, and normalize → XADD.
 */
export interface SourceAdapter {
  readonly sourceTag: SourceTag
  /**
   * Connect, listen, normalize, and emit UnifiedSignals (adapter XADDs to unified / per-source stream).
   * `emit` is provided by the ingestion runtime for fan-in, metrics, or test harnesses.
   */
  start(emit: (signal: UnifiedSignal) => Promise<void>): Promise<void>
  stop(): Promise<void>
}

// ── Redis: multi-source ingestion keys (prefix ccai:sig:) ─────────────────────

/** Per-source ingress stream — burst isolation before fan-in. */
export function signalSourceStreamKey(sourceTag: SourceTag): string {
  return `ccai:sig:stream:source:${sourceTag}`
}

/** Unified stream — single consumer group for gate / enrich workers. */
export const SIGNAL_STREAM_UNIFIED = 'ccai:sig:stream:unified'

export const SIGNAL_CONSUMER_GROUP_GATE = 'ccai:sig:cg:gate'

/** SETNX dedup at ingest: full key = `${SIGNAL_DEDUP_ID_PREFIX}${signal.id}` */
export const SIGNAL_DEDUP_ID_PREFIX = 'ccai:sig:dedup:id:'

/** Stream envelope field name (JSON UnifiedSignal). */
export const SIGNAL_UNIFIED_STREAM_FIELD = 'data'

/** Build canonical namespaced id. */
export function namespacedSignalId(sourceTag: SourceTag, sourceRef: string): string {
  return `${sourceTag}:${sourceRef}`
}

/** Realtime feed events — unified envelope (Prompt 4 polymorphic UI). */
export type UnifiedFeedEvent =
  | { type: 'signal.new'; signal: UnifiedSignal }
  | { type: 'signal.update'; signal: UnifiedSignal }
  | { type: 'signal.remove'; id: string; reason?: string }
  | { type: 'batch'; events: UnifiedFeedEvent[]; coalescedAt: string }

/** Server-side subscription filter — extends legacy token filters with source + subject. */
export type UnifiedFeedFilter = {
  sourceTag?: SourceTag | 'all'
  subjectType?: SubjectType
  minVerdict?: Exclude<UnifiedVerdict, 'scanning' | 'n/a'>
  minSourceCount?: number
  chain?: string
  search?: string
}
