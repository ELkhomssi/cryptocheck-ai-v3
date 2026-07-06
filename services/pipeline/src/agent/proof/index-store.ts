import type { ProofRecord } from '@cryptocheck/signal-contracts'
import { SIGNAL_PROOF_INDEX_PREFIX } from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'

/**
 * Off-chain index: commitmentHash → full ProofRecord.
 * Memory always; Redis optional for multi-process / dashboard verify.
 */
export class ProofIndex {
  private memory = new Map<string, ProofRecord>()
  private byDecision = new Map<string, string>()
  private bySettlement = new Map<string, string>()
  private redis: Redis | null

  constructor(redis?: Redis | null) {
    this.redis = redis ?? null
  }

  async put(record: ProofRecord): Promise<void> {
    this.memory.set(record.commitmentHash, record)
    if (record.commitment.kind === 'decision') {
      this.byDecision.set(record.commitment.decisionId, record.commitmentHash)
    } else {
      this.bySettlement.set(record.commitment.settlementId, record.commitmentHash)
    }

    if (this.redis) {
      const key = `${SIGNAL_PROOF_INDEX_PREFIX}${record.commitmentHash}`
      await this.redis.set(key, JSON.stringify(record), { ex: 60 * 60 * 24 * 30 })
      if (record.commitment.kind === 'decision') {
        await this.redis.set(
          `${SIGNAL_PROOF_INDEX_PREFIX}dec:${record.commitment.decisionId}`,
          record.commitmentHash,
          { ex: 60 * 60 * 24 * 30 },
        )
      } else {
        await this.redis.set(
          `${SIGNAL_PROOF_INDEX_PREFIX}stl:${record.commitment.settlementId}`,
          record.commitmentHash,
          { ex: 60 * 60 * 24 * 30 },
        )
      }
    }
  }

  async get(commitmentHash: string): Promise<ProofRecord | null> {
    const local = this.memory.get(commitmentHash)
    if (local) return local
    if (!this.redis) return null
    const raw = await this.redis.get<string>(`${SIGNAL_PROOF_INDEX_PREFIX}${commitmentHash}`)
    if (!raw) return null
    try {
      const record = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ProofRecord
      this.memory.set(commitmentHash, record)
      return record
    } catch {
      return null
    }
  }

  async getByDecisionId(decisionId: string): Promise<ProofRecord | null> {
    const hash = this.byDecision.get(decisionId)
    if (hash) return this.get(hash)
    if (!this.redis) return null
    const h = await this.redis.get<string>(`${SIGNAL_PROOF_INDEX_PREFIX}dec:${decisionId}`)
    return h ? this.get(h) : null
  }

  list(): ProofRecord[] {
    return [...this.memory.values()]
  }
}
