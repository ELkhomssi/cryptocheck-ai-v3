import type { SignalProofCall } from '@cryptocheck/signal-contracts'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { agentPubkeyFromConfig } from '../agent/proof/commitment.js'
import { explorerTxUrl } from '../agent/proof/commitment.js'
import { writeMemoCommitment } from '../agent/proof/memo.js'
import { signCommitment } from '../agent/sign.js'
import type { AssessResult } from '../enrich/assess-client.js'
import {
  buildTokenCallCommitment,
  hashTokenCallCommitment,
  newCallId,
  tokenVerdict,
} from './commitment.js'
import { loadProofEngineConfig, selectTokenCall } from './config.js'
import { insertProofCall } from './persist.js'
import { publishProofCallToTelegram } from './publish.js'

const DEDUP_PREFIX = 'ccai:sig:proof:call:dedup:'
const DEDUP_TTL_SEC = 86_400

export class TokenProofEngine {
  private cfg = loadProofEngineConfig()
  private agentId = process.env.SIGNAL_AGENT_ID?.trim() || 'ccai-proof'
  private agentPubkey = agentPubkeyFromConfig(
    this.agentId,
    process.env.SIGNAL_AGENT_PUBKEY?.trim(),
  )

  constructor(private redis: import('@upstash/redis').Redis) {}

  async maybeRecordCall(signal: UnifiedSignal, assessment: AssessResult): Promise<void> {
    if (!this.cfg.enabled) return

    const selection = selectTokenCall(signal, assessment, this.cfg)
    if (!selection) return

    const mint = signal.contractAddress?.trim() ?? ''
    if (!mint) return

    const dedupKey = `${DEDUP_PREFIX}${mint}:${selection.callType}`
    const acquired = await this.redis.set(dedupKey, '1', { nx: true, ex: DEDUP_TTL_SEC })
    if (!acquired) return

    const callId = newCallId()
    const { commitment, dataHash } = buildTokenCallCommitment({
      callId,
      signal,
      callType: selection.callType,
      assessment,
      agentPubkey: this.agentPubkey,
    })
    const commitmentHash = hashTokenCallCommitment(commitment)

    if (this.cfg.dryRun) {
      console.info('[proof-engine] dry-run selection', {
        callId,
        callType: selection.callType,
        mint,
        symbol: signal.label,
        commitmentHash,
        evidence: selection.evidenceSummary,
      })
      return
    }

    const hmac = signCommitment(commitment as unknown as Record<string, unknown>)
    let commitTx = `paper:${commitmentHash.slice(0, 16)}`
    let explorerUrl: string | undefined

    const live = process.env.SIGNAL_AGENT_PROOF_LIVE === 'true'
    if (live) {
      try {
        const memo = await writeMemoCommitment(commitmentHash)
        if (memo) {
          commitTx = memo.txSignature
          explorerUrl = explorerTxUrl(memo.txSignature, memo.cluster)
        }
      } catch (e) {
        console.warn('[proof-engine] on-chain commit failed — paper fallback', e instanceof Error ? e.message : e)
      }
    }

    const calledAt = new Date().toISOString()
    const row = {
      id: callId,
      signalId: signal.id,
      mint,
      symbol: signal.tokenSymbol ?? signal.label,
      callType: selection.callType,
      verdict: tokenVerdict(signal),
      neuralScore: assessment.neuralScore ?? signal.scoreValue ?? 0,
      evidenceSummary: selection.evidenceSummary,
      calledAt,
      commitTx,
      dataHash,
      commitmentHash,
      hmacSignature: hmac?.signature,
      explorerUrl,
      priceAtCall: typeof signal.value === 'number' ? signal.value : undefined,
    }

    const saved = await insertProofCall(row)
    if (!saved) return

    console.info('[proof-engine] committed call', {
      id: callId,
      callType: selection.callType,
      mint,
      commitTx,
    })

    if (this.cfg.autoPost) {
      const proofCall: SignalProofCall = {
        id: callId,
        signalId: signal.id,
        mint,
        symbol: signal.tokenSymbol ?? signal.label,
        callType: selection.callType,
        verdict: tokenVerdict(signal),
        neuralScore: row.neuralScore,
        evidenceSummary: selection.evidenceSummary,
        calledAt,
        commitTx,
        dataHash,
        commitmentHash,
        hmacSignature: hmac?.signature,
        explorerUrl,
        outcome: 'pending',
        priceAtCall: row.priceAtCall,
      }
      await publishProofCallToTelegram(proofCall)
    }
  }
}
