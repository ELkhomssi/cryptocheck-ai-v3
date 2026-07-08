/**
 * AI Sniper engine contracts (services/sniper).
 *
 * The Sniper worker is a market-wide DETECTOR: it consumes new token signals,
 * runs the Scanner (kill-switch), and — for high-conviction, safe tokens —
 * emits a SnipeCandidate. It NEVER signs or moves funds (non-custodial): the
 * user's browser builds + signs the swap via Phantom. Per-user subscription
 * gating ($10/mo Full Auto) is enforced at the execution/arming layer.
 */
import type { ScanRedFlag, ScanVerdict } from './scanner.js'

/** Own consumer group on the unified stream (independent of the gate). */
export const SIGNAL_CONSUMER_GROUP_SNIPER = 'ccai:sig:cg:sniper'

/** Durable stream of snipe candidates for UI / execution layer. */
export const SIGNAL_SNIPE_CANDIDATES_STREAM = 'ccai:sig:snipe:candidates'

/** Pub/sub channel for low-latency candidate push. */
export const SIGNAL_SNIPE_PUBSUB_CHANNEL = 'ccai:sig:snipe:pub'

/** Stream envelope field (JSON SnipeCandidate). */
export const SNIPE_STREAM_FIELD = 'data'

/**
 * A vetted, safe, high-conviction snipe opportunity. Market-wide (no user):
 * the execution layer attaches wallet + sniper params per armed Pro user.
 */
export type SnipeCandidate = {
  /** Source signal id (namespaced `${sourceTag}:${sourceRef}`). */
  id: string
  mint: string
  symbol: string
  chain: string
  sourceTag: string
  /** 0..100 safety (scanner neuralScore). */
  neuralScore: number
  riskScore: number
  verdict: ScanVerdict
  /** Always true for emitted candidates — kept for auditability. */
  safeToSnipe: boolean
  redFlags: ScanRedFlag[]
  evidenceSummary: string
  detectedAt: string
  scanLatencyMs: number
}

/** Granular audit actions written to signal_snipe_actions. */
export type SnipeActionType = 'scan' | 'candidate' | 'blocked' | 'attempt' | 'swap'

export type SnipeActionRecord = {
  id: string
  /** null for market-wide worker actions; set for per-user attempt/swap. */
  userId?: string | null
  signalId: string
  mint: string
  symbol: string
  action: SnipeActionType
  /** true = passed kill-switch + threshold; false = blocked/skipped. */
  allowed: boolean
  neuralScore: number
  verdict: string
  redFlags: ScanRedFlag[]
  evidenceSummary: string
  blockedReason?: string
  /** Present on 'swap' after a confirmed on-chain signature. */
  txSignature?: string
  createdAt: string
}
