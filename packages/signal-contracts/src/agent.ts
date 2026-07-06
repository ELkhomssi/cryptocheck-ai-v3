/**
 * Sentinel Edge — AgentEngine contracts (Prompt B).
 * Autonomous, capped decisions on match_event only.
 * Execution = decision commitments (Prompt C), NOT Jupiter / fiat betting.
 */

import type { EdgeDetectorId, EdgeSignal } from './edge-signal.js'
import type { ProofRef } from './proof.js'

export type AgentMode = 'paper' | 'live'

export type DecisionSide = 'home' | 'away' | 'back' | 'lay' | 'unknown'

export type DecisionStatus = 'open' | 'settled' | 'void'

export type SettlementOutcome = 'win' | 'lose' | 'push' | 'void'

/** Per-agent risk + detector config. Autonomous mode is opt-in (`enabled`). */
export type AgentConfig = {
  agentId: string
  /** Explicit opt-in — false means engine never opens decisions. */
  enabled: boolean
  /** Hard kill-switch — halts all new decisions immediately. */
  killSwitch: boolean
  mode: AgentMode
  enabledDetectors: EdgeDetectorId[]
  /** Min EdgeSignal.magnitude (0–100). */
  edgeThreshold: number
  /** Min EdgeSignal.confidence (0–1). */
  confidenceFloor: number
  /** Max size per decision (paper units). */
  maxPositionSize: number
  /** Max open exposure per matchId. */
  perMatchCap: number
  /** Stop new decisions when daily realized PnL ≤ -limit. */
  dailyLossLimit: number
  /** Public id for proof layer (Prompt C); not a custody key. */
  agentPubkey?: string
}

/**
 * Autonomous decision — no manual input.
 * dataHash binds the decision to the exact TxODDS packet that triggered it.
 */
export type Decision = {
  id: string
  agentId: string
  matchId: string
  signalId: string
  market: string
  side: DecisionSide
  size: number
  edgeSignal: EdgeSignal
  /** sha256 of canonical raw TxODDS packet. */
  dataHash: string
  timestamp: string
  mode: AgentMode
  status: DecisionStatus
  /** HMAC over commitment fields via @cryptocheck/signing. */
  signature?: string
  /** Unix seconds used in HMAC message. */
  signedAt?: string
  entryOdds: number
  label?: string
  /** On-chain / paper proof ref (Prompt C). */
  proof?: ProofRef
}

export type Settlement = {
  id: string
  decisionId: string
  agentId: string
  matchId: string
  outcome: SettlementOutcome
  /** Realized PnL in paper units (stake * (odds-1) win, -stake lose). */
  realizedPnl: number
  settledAt: string
  finalScore?: { home: number; away: number }
  dataHash: string
  signature?: string
  signedAt?: string
  mode: AgentMode
  /** On-chain / paper proof ref (Prompt C). */
  proof?: ProofRef
}

export type AgentStandDown = {
  agentId: string
  matchId?: string
  signalId?: string
  reason: string
  timestamp: string
}

/** Realtime / dashboard events — never on Jupiter swap path. */
export type AgentFeedEvent =
  | { type: 'agent.decision'; decision: Decision }
  | { type: 'agent.settlement'; settlement: Settlement }
  | { type: 'agent.stand_down'; standDown: AgentStandDown }

/** Redis stream + pub/sub for agent tape (Prompt D dashboard). */
export const SIGNAL_STREAM_AGENT = 'ccai:sig:stream:agent'
export const SIGNAL_PUBSUB_AGENT = 'ccai:sig:pub:agent'
export const SIGNAL_AGENT_STATE_KEY = 'ccai:sig:agent:state'
/** Dashboard → gate control plane (kill-switch, mode, caps). */
export const SIGNAL_AGENT_CONTROL_KEY = 'ccai:sig:agent:control'
/** Latest paper backtest track record (written by `npm run backtest`). */
export const SIGNAL_AGENT_BACKTEST_KEY = 'ccai:sig:agent:backtest:latest'

/** Mutable controls from Sentinel Edge dashboard (Prompt D). */
export type AgentControlState = {
  enabled: boolean
  killSwitch: boolean
  mode: AgentMode
  edgeThreshold: number
  confidenceFloor: number
  maxPositionSize: number
  perMatchCap: number
  dailyLossLimit: number
  updatedAt: string
}

export const AGENT_COMPLIANCE = {
  disclaimer: 'Informational / on-chain research agent — not betting, not financial advice',
  label: 'Sentinel Edge — verifiable decision commitments only',
} as const
