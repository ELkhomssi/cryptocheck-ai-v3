/**
 * AgentEngine — autonomous, capped decisions on enriched match_event signals.
 * Prompt B + proof commits (Prompt C). Does NOT touch Jupiter / frozen scanner.
 */
import { randomUUID } from 'node:crypto'
import type {
  AgentConfig,
  AgentFeedEvent,
  AgentStandDown,
  Decision,
  Settlement,
  UnifiedSignal,
} from '@cryptocheck/signal-contracts'
import { applyControlFromRedis } from './control-sync.js'
import { hashRawPacket } from './data-hash.js'
import { ProofLayer } from './proof/layer.js'
import { checkRiskCaps } from './risk.js'
import { publishAgentEvent } from './publish.js'
import { buildSettlement, shouldSettle } from './settle.js'
import { AgentStore } from './store.js'
import type { Redis } from '@upstash/redis'

export type AgentEngineResult =
  | { kind: 'decision'; decision: Decision }
  | { kind: 'settlement'; settlements: Settlement[] }
  | { kind: 'stand_down'; standDown: AgentStandDown }
  | { kind: 'noop' }

export class AgentEngine {
  private config: AgentConfig
  private store: AgentStore
  private redis: Redis | null
  private proof: ProofLayer

  constructor(config: AgentConfig, redis?: Redis | null, store?: AgentStore) {
    this.config = { ...config }
    this.store = store ?? new AgentStore()
    this.redis = redis ?? null
    this.proof = this.makeProofLayer()
  }

  private makeProofLayer(): ProofLayer {
    return new ProofLayer({
      agentId: this.config.agentId,
      agentPubkey: this.config.agentPubkey,
      mode: this.config.mode,
      redis: this.redis,
    })
  }

  getConfig(): AgentConfig {
    return { ...this.config }
  }

  getStore(): AgentStore {
    return this.store
  }

  getProof(): ProofLayer {
    return this.proof
  }

  /** Explicit opt-in toggle. */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
  }

  /** Hard kill-switch — halts all new decisions immediately. */
  setKillSwitch(active: boolean): void {
    this.config.killSwitch = active
  }

  updateConfig(patch: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...patch, agentId: patch.agentId ?? this.config.agentId }
    this.proof = this.makeProofLayer()
  }

  private async emit(event: AgentFeedEvent): Promise<void> {
    if (!this.redis) return
    await publishAgentEvent(this.redis, event)
  }

  private async standDown(
    reason: string,
    signal?: UnifiedSignal,
  ): Promise<AgentEngineResult> {
    const standDown: AgentStandDown = {
      agentId: this.config.agentId,
      matchId: signal?.matchId,
      signalId: signal?.id,
      reason,
      timestamp: new Date().toISOString(),
    }
    this.store.markStandDown()
    await this.emit({ type: 'agent.stand_down', standDown })
    return { kind: 'stand_down', standDown }
  }

  /**
   * Consume one enriched match_event.
   * Opens a Decision when edge + caps pass; settles open decisions on full_time.
   * Every decision/settlement is proof-committed (paper or live Memo).
   */
  async onSignal(signal: UnifiedSignal): Promise<AgentEngineResult> {
    if (signal.subjectType !== 'match_event') return { kind: 'noop' }
    if (signal.dropped || signal.sample) return { kind: 'noop' }

    // Dashboard control plane (Prompt D) — kill-switch / mode / caps
    const prevMode = this.config.mode
    this.config = await applyControlFromRedis(this.redis, this.config)
    if (this.config.mode !== prevMode) {
      this.proof = this.makeProofLayer()
    }

    if (shouldSettle(signal) && signal.matchId) {
      return this.settleMatch(signal)
    }

    if (!this.config.enabled) return { kind: 'noop' }

    const edge = signal.edgeSignal
    if (!edge) return { kind: 'noop' }

    const risk = checkRiskCaps(this.config, this.store, signal, edge)
    if (risk.ok === false) {
      const hardStop =
        risk.reason.includes('kill-switch') ||
        risk.reason.includes('daily loss') ||
        risk.reason.includes('per-match cap')
      if (!hardStop) return { kind: 'noop' }
      return this.standDown(risk.reason, signal)
    }

    const dataHash = hashRawPacket(signal.rawPayload ?? {})
    const timestamp = new Date().toISOString()
    const entryOdds =
      edge.marketValue > 1 ? edge.marketValue : edge.fairValue > 1 ? edge.fairValue : 2

    const decision: Decision = {
      id: `dec_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      agentId: this.config.agentId,
      matchId: signal.matchId!,
      signalId: signal.id,
      market: signal.market ?? edge.detectors[0]?.detector ?? 'match',
      side: risk.side,
      size: risk.size,
      edgeSignal: edge,
      dataHash,
      timestamp,
      mode: this.config.mode,
      status: 'open',
      entryOdds,
      label: signal.label,
    }

    // Prompt C — tamper-evident commitment (Memo live or paper index)
    const proof = await this.proof.commitDecision(decision, signal.rawPayload ?? {})
    decision.proof = proof
    const proofRec = await this.proof.getIndex().get(proof.commitmentHash)
    if (proofRec?.hmacSignature) {
      decision.signature = proofRec.hmacSignature
      decision.signedAt = proofRec.hmacSignedAt
    }

    this.store.addDecision(decision)
    await this.emit({ type: 'agent.decision', decision })

    console.info('[AgentEngine] decision', {
      id: decision.id,
      matchId: decision.matchId,
      side: decision.side,
      size: decision.size,
      magnitude: edge.magnitude,
      mode: decision.mode,
      commitmentHash: proof.commitmentHash.slice(0, 12),
      tx: proof.txSignature?.slice(0, 20),
      rationale: edge.rationale.slice(0, 100),
    })

    return { kind: 'decision', decision }
  }

  private async settleMatch(signal: UnifiedSignal): Promise<AgentEngineResult> {
    const open = this.store.listOpenForMatch(signal.matchId!)
    if (!open.length) return { kind: 'noop' }

    const settlements: Settlement[] = []
    for (const decision of open) {
      const settlement = buildSettlement(decision, signal)
      const proof = await this.proof.commitSettlement(settlement)
      settlement.proof = proof
      const proofRec = await this.proof.getIndex().get(proof.commitmentHash)
      if (proofRec?.hmacSignature) {
        settlement.signature = proofRec.hmacSignature
        settlement.signedAt = proofRec.hmacSignedAt
      }

      const closed: Decision = { ...decision, status: 'settled' }
      this.store.addSettlement(settlement, closed)
      await this.emit({ type: 'agent.settlement', settlement })
      settlements.push(settlement)
      console.info('[AgentEngine] settlement', {
        decisionId: settlement.decisionId,
        outcome: settlement.outcome,
        pnl: settlement.realizedPnl,
        commitmentHash: proof.commitmentHash.slice(0, 12),
      })
    }
    return { kind: 'settlement', settlements }
  }
}
