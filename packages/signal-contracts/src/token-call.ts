import type { SentinelVerdict } from './index.js'

export type TokenCallType = 'rug_alert' | 'smart_money' | 'safe_entry'

export type TokenCallOutcome = 'pending' | 'hit' | 'miss' | 'expired'

/** On-chain commitment payload for verifiable token calls. */
export type TokenCallCommitment = {
  kind: 'token_call'
  agentPubkey: string
  callId: string
  mint: string
  symbol: string
  callType: TokenCallType
  verdict: SentinelVerdict
  neuralScore: number
  dataHash: string
  timestamp: string
}

/** Public proof call row — maps to `signal_proof_calls` in Postgres. */
export type SignalProofCall = {
  id: string
  signalId: string
  mint: string
  symbol: string
  callType: TokenCallType
  verdict: SentinelVerdict
  neuralScore: number
  evidenceSummary: string
  calledAt: string
  commitTx: string
  dataHash: string
  commitmentHash: string
  hmacSignature?: string
  explorerUrl?: string
  outcome: TokenCallOutcome
  outcomeEvidence?: string
  gradedAt?: string
  priceAtCall?: number
  priceAtGrade?: number
  sample?: boolean
}

export type ProofCallTrackRecord = {
  hitRate: number | null
  callsThisMonth: number
  pending: number
  hits: number
  misses: number
  avgLeadTimeMinutes: number | null
  calls: SignalProofCall[]
}
