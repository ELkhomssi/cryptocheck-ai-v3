import { createHash } from 'node:crypto'
import type {
  Commitment,
  Decision,
  DecisionCommitment,
  Settlement,
  SettlementCommitment,
} from '@cryptocheck/signal-contracts'
import { PROOF_MEMO_PREFIX } from '@cryptocheck/signal-contracts'
import { canonicalJson } from '../data-hash.js'

export function agentPubkeyFromConfig(agentId: string, pubkey?: string): string {
  return pubkey?.trim() || `agent:${agentId}`
}

export function buildDecisionCommitment(
  decision: Decision,
  agentPubkey: string,
): DecisionCommitment {
  return {
    kind: 'decision',
    agentPubkey,
    decisionId: decision.id,
    signalId: decision.signalId,
    matchId: decision.matchId,
    dataHash: decision.dataHash,
    side: decision.side,
    size: decision.size,
    edgeMagnitude: decision.edgeSignal.magnitude,
    timestamp: decision.timestamp,
  }
}

export function buildSettlementCommitment(
  settlement: Settlement,
  agentPubkey: string,
): SettlementCommitment {
  return {
    kind: 'settlement',
    agentPubkey,
    settlementId: settlement.id,
    decisionId: settlement.decisionId,
    matchId: settlement.matchId,
    outcome: settlement.outcome,
    realizedPnl: settlement.realizedPnl,
    dataHash: settlement.dataHash,
    timestamp: settlement.settledAt,
  }
}

/** commitmentHash = sha256(canonical commitment) — what goes on-chain in Memo. */
export function hashCommitment(commitment: Commitment): string {
  return createHash('sha256').update(canonicalJson(commitment), 'utf8').digest('hex')
}

export function memoFromCommitmentHash(commitmentHash: string): string {
  return `${PROOF_MEMO_PREFIX}${commitmentHash}`
}

export function commitmentHashFromMemo(memo: string): string | null {
  const t = memo.trim()
  if (!t.startsWith(PROOF_MEMO_PREFIX)) return null
  const hash = t.slice(PROOF_MEMO_PREFIX.length).trim().toLowerCase()
  return /^[0-9a-f]{64}$/.test(hash) ? hash : null
}

export function explorerTxUrl(signature: string, cluster?: string): string {
  if (signature.startsWith('paper:')) return ''
  const c = cluster === 'devnet' || cluster === 'testnet' ? `?cluster=${cluster}` : ''
  return `https://explorer.solana.com/tx/${signature}${c}`
}
