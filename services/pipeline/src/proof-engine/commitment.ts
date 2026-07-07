import { createHash, randomUUID } from 'node:crypto'
import type { SentinelVerdict, TokenCallCommitment, TokenCallType } from '@cryptocheck/signal-contracts'
import { PROOF_MEMO_PREFIX } from '@cryptocheck/signal-contracts'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { canonicalJson, hashRawPacket } from '../agent/data-hash.js'
import type { AssessResult } from '../enrich/assess-client.js'

export function tokenVerdict(signal: UnifiedSignal): SentinelVerdict {
  if (signal.verdict === 'scanning' || signal.verdict === 'n/a') return 'caution'
  return signal.verdict
}

export function buildTokenCallCommitment(opts: {
  callId: string
  signal: UnifiedSignal
  callType: TokenCallType
  assessment: AssessResult
  agentPubkey: string
}): { commitment: TokenCallCommitment; dataHash: string } {
  const rawPacket = {
    signalId: opts.signal.id,
    mint: opts.signal.contractAddress,
    symbol: opts.signal.tokenSymbol ?? opts.signal.label,
    assessment: opts.assessment,
    msgTimestamp: opts.signal.msgTimestamp,
  }
  const dataHash = hashRawPacket(rawPacket)

  const commitment: TokenCallCommitment = {
    kind: 'token_call',
    agentPubkey: opts.agentPubkey,
    callId: opts.callId,
    mint: opts.signal.contractAddress?.trim() ?? '',
    symbol: opts.signal.tokenSymbol ?? opts.signal.label,
    callType: opts.callType,
    verdict: tokenVerdict(opts.signal),
    neuralScore: opts.assessment.neuralScore ?? opts.signal.scoreValue ?? 0,
    dataHash,
    timestamp: new Date().toISOString(),
  }

  return { commitment, dataHash }
}

export function hashTokenCallCommitment(commitment: TokenCallCommitment): string {
  return createHash('sha256').update(canonicalJson(commitment), 'utf8').digest('hex')
}

export function newCallId(): string {
  return randomUUID()
}

export function memoFromHash(commitmentHash: string): string {
  return `${PROOF_MEMO_PREFIX}${commitmentHash}`
}
