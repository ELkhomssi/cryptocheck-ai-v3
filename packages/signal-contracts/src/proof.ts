/**
 * Sentinel Edge — on-chain proof / audit trail (Prompt C).
 * Tamper-evident decision + settlement commitments (Memo MVP).
 */

import type { AgentMode, DecisionSide, SettlementOutcome } from './agent.js'

/** Compact commitment written (hashed) on-chain via Memo. */
export type DecisionCommitment = {
  kind: 'decision'
  agentPubkey: string
  decisionId: string
  signalId: string
  matchId: string
  dataHash: string
  side: DecisionSide
  size: number
  edgeMagnitude: number
  timestamp: string
}

export type SettlementCommitment = {
  kind: 'settlement'
  agentPubkey: string
  settlementId: string
  decisionId: string
  matchId: string
  outcome: SettlementOutcome
  realizedPnl: number
  dataHash: string
  timestamp: string
}

export type Commitment = DecisionCommitment | SettlementCommitment

/** Off-chain index entry: commitmentHash → full record for verify(). */
export type ProofRecord = {
  commitmentHash: string
  commitment: Commitment
  /** HMAC over commitment fields (@cryptocheck/signing). */
  hmacSignature?: string
  hmacSignedAt?: string
  /** Solana tx signature, or `paper:<hashPrefix>` when not broadcast. */
  txSignature?: string
  explorerUrl?: string
  /** Source packet for dataHash re-check (decision proofs). */
  rawPacket?: Record<string, unknown>
  mode: AgentMode
  createdAt: string
}

export type ProofRef = {
  commitmentHash: string
  txSignature?: string
  explorerUrl?: string
  committedAt: string
}

export type VerifyCheck = {
  dataHashMatch: boolean
  commitmentHashMatch: boolean
  hmacValid: boolean | null
  onChainMatch: boolean | null
}

export type VerifyResult = {
  ok: boolean
  commitmentHash: string
  checks: VerifyCheck
  details: string[]
}

/** Memo prefix — Sentinel Edge v1. */
export const PROOF_MEMO_PREFIX = 'SE1:'

export const SIGNAL_PROOF_INDEX_PREFIX = 'ccai:sig:proof:'
