/**
 * ProofLayer — commit decisions/settlements, index, verify (Prompt C).
 */
import type {
  AgentMode,
  Decision,
  ProofRecord,
  ProofRef,
  Settlement,
  VerifyResult,
} from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'
import { signCommitment } from '../sign.js'
import {
  agentPubkeyFromConfig,
  buildDecisionCommitment,
  buildSettlementCommitment,
  explorerTxUrl,
  hashCommitment,
} from './commitment.js'
import { ProofIndex } from './index-store.js'
import { writeMemoCommitment } from './memo.js'
import { verifyDecisionProof, verifyProof } from './verify.js'

export class ProofLayer {
  private index: ProofIndex
  private agentId: string
  private agentPubkey: string
  private mode: AgentMode

  constructor(opts: {
    agentId: string
    agentPubkey?: string
    mode: AgentMode
    redis?: Redis | null
  }) {
    this.agentId = opts.agentId
    this.agentPubkey = agentPubkeyFromConfig(opts.agentId, opts.agentPubkey)
    this.mode = opts.mode
    this.index = new ProofIndex(opts.redis)
  }

  getIndex(): ProofIndex {
    return this.index
  }

  /**
   * Commit a decision: hash commitment, optional Memo write, index full record.
   * Paper mode uses `paper:<hashPrefix>` tx marker when live write is off.
   */
  async commitDecision(
    decision: Decision,
    rawPacket: Record<string, unknown>,
  ): Promise<ProofRef> {
    const commitment = buildDecisionCommitment(decision, this.agentPubkey)
    const commitmentHash = hashCommitment(commitment)
    const hmac = signCommitment(commitment as unknown as Record<string, unknown>)

    let txSignature: string | undefined
    let explorerUrl: string | undefined

    if (this.mode === 'live') {
      try {
        const live = await writeMemoCommitment(commitmentHash)
        if (live) {
          txSignature = live.txSignature
          explorerUrl = explorerTxUrl(live.txSignature, live.cluster)
        }
      } catch (e) {
        console.warn(
          '[ProofLayer] live memo write failed — falling back to paper',
          e instanceof Error ? e.message : e,
        )
      }
    }

    if (!txSignature) {
      txSignature = `paper:${commitmentHash.slice(0, 16)}`
    }

    const { edgeSignal: _e, ...sourcePacket } = rawPacket

    const record: ProofRecord = {
      commitmentHash,
      commitment,
      hmacSignature: hmac?.signature,
      hmacSignedAt: hmac?.signedAt,
      txSignature,
      explorerUrl: explorerUrl || undefined,
      rawPacket: sourcePacket,
      mode: txSignature.startsWith('paper:') ? 'paper' : 'live',
      createdAt: new Date().toISOString(),
    }

    await this.index.put(record)

    return {
      commitmentHash,
      txSignature,
      explorerUrl: record.explorerUrl,
      committedAt: record.createdAt,
    }
  }

  async commitSettlement(settlement: Settlement): Promise<ProofRef> {
    const commitment = buildSettlementCommitment(settlement, this.agentPubkey)
    const commitmentHash = hashCommitment(commitment)
    const hmac = signCommitment(commitment as unknown as Record<string, unknown>)

    let txSignature: string | undefined
    let explorerUrl: string | undefined

    if (this.mode === 'live') {
      try {
        const live = await writeMemoCommitment(commitmentHash)
        if (live) {
          txSignature = live.txSignature
          explorerUrl = explorerTxUrl(live.txSignature, live.cluster)
        }
      } catch (e) {
        console.warn(
          '[ProofLayer] settlement memo write failed — paper fallback',
          e instanceof Error ? e.message : e,
        )
      }
    }

    if (!txSignature) {
      txSignature = `paper:${commitmentHash.slice(0, 16)}`
    }

    const record: ProofRecord = {
      commitmentHash,
      commitment,
      hmacSignature: hmac?.signature,
      hmacSignedAt: hmac?.signedAt,
      txSignature,
      explorerUrl: explorerUrl || undefined,
      mode: txSignature.startsWith('paper:') ? 'paper' : 'live',
      createdAt: new Date().toISOString(),
    }

    await this.index.put(record)

    return {
      commitmentHash,
      txSignature,
      explorerUrl: record.explorerUrl,
      committedAt: record.createdAt,
    }
  }

  async verify(commitmentHash: string): Promise<VerifyResult> {
    return verifyProof(this.index, commitmentHash)
  }

  async verifyDecision(decisionId: string): Promise<VerifyResult> {
    return verifyDecisionProof(this.index, decisionId)
  }
}
