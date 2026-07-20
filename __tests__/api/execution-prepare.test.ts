import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_CAPITAL_POLICY,
  DEFAULT_STRATEGY_CONFIGS,
  riskCategoryFromScore,
} from '../../lib/execution/types'
import {
  planJitoExecution,
  congestionFromRecentSlotLag,
} from '../../lib/execution/jito'
import type { OpportunityIntake } from '../../lib/execution/types'
import type { PreparedExecution as Prep } from '../../lib/execution/ports'

/** Mirror of preparedToAuditStatus without pulling server-only audit-store. */
function preparedToAuditStatus(prepared: Prep): string {
  if (prepared.allowed) return 'in_progress'
  if (prepared.blockReason?.includes('Critical') || prepared.blockReason?.includes('risk')) {
    return 'rejected_risk'
  }
  if (
    prepared.blockReason?.includes('exposure') ||
    prepared.blockReason?.includes('Daily loss') ||
    prepared.blockReason?.includes('positions') ||
    prepared.blockReason?.includes('Slippage')
  ) {
    return 'rejected_capital'
  }
  if (prepared.blockReason?.includes('Simulation') || prepared.blockReason?.includes('confidence')) {
    return 'rejected_simulation'
  }
  if (prepared.blockReason?.includes('Safety')) return 'rejected_safety'
  if (prepared.blockReason?.includes('congestion')) return 'expired'
  return 'rejected_risk'
}

describe('execution OMS — risk categories', () => {
  it('maps scores to capital-first categories', () => {
    assert.equal(riskCategoryFromScore(10), 'low')
    assert.equal(riskCategoryFromScore(40), 'medium')
    assert.equal(riskCategoryFromScore(65), 'high')
    assert.equal(riskCategoryFromScore(80), 'critical')
    assert.equal(riskCategoryFromScore(99), 'critical')
  })
})

describe('execution OMS — strategies', () => {
  it('conservative is stricter than aggressive', () => {
    const a = DEFAULT_STRATEGY_CONFIGS.aggressive
    const c = DEFAULT_STRATEGY_CONFIGS.conservative
    assert.ok(c.minLiquidityUsd > a.minLiquidityUsd)
    assert.ok(c.minSafetyScore > a.minSafetyScore)
    assert.ok(c.minSimulationConfidence > a.minSimulationConfidence)
    assert.ok(c.maxPriceImpactPct < a.maxPriceImpactPct)
  })

  it('post_dump_entry waits for stabilization', () => {
    assert.ok(DEFAULT_STRATEGY_CONFIGS.post_dump_entry.stabilizeWaitMs > 0)
  })
})

describe('execution OMS — capital policy', () => {
  it('defaults block critical and cap size', () => {
    assert.equal(DEFAULT_CAPITAL_POLICY.blockCritical, true)
    assert.ok(DEFAULT_CAPITAL_POLICY.maxSolPerTrade > 0)
    assert.ok(DEFAULT_CAPITAL_POLICY.maxSlippageBps <= 500)
  })
})

describe('execution OMS — Jito plan', () => {
  const opp: OpportunityIntake = {
    opportunityId: 'test-opp',
    source: 'sniper',
    userId: 'user',
    walletAddress: '11111111111111111111111111111111',
    mint: 'So11111111111111111111111111111111111111112',
    chain: 'solana',
    side: 'buy',
    amountSol: 0.25,
    strategy: 'balanced',
    maxSlippageBps: 100,
    createdAt: new Date().toISOString(),
  }

  it('scales tip with congestion and aborts when extreme', () => {
    assert.equal(congestionFromRecentSlotLag(3000), 'extreme')
    const extreme = planJitoExecution(opp, {
      congestion: 'extreme',
      baseTipLamports: 100_000,
      enabled: true,
    })
    assert.equal(extreme.fallback, 'abort')

    const low = planJitoExecution(opp, {
      congestion: 'low',
      baseTipLamports: 100_000,
      enabled: true,
    })
    assert.ok(low.tipLamports > 0)
    assert.notEqual(low.fallback, 'abort')
  })
})

describe('execution OMS — audit status mapping', () => {
  it('maps block reasons to terminal statuses', () => {
    const base: Prep = {
      auditId: 'a',
      opportunityId: 'o',
      allowed: false,
      blockReason: 'Simulation confidence 0.2 < 0.85',
      risk: {
        opportunityId: 'o',
        riskScore: 20,
        category: 'low',
        verdict: 'SAFE',
        mintAuthorityActive: false,
        freezeAuthorityActive: false,
        liquidityUsd: null,
        holderConcentrationPct: null,
        tokenAgeSec: null,
        transferRestricted: null,
        metadataOk: true,
        reasons: [],
        warnings: [],
        scannedAt: new Date().toISOString(),
        gatewayPath: 'assessRiskByMint',
      },
      simulation: null,
      safety: null,
      capital: null,
      jitoPlan: null,
    }
    assert.equal(preparedToAuditStatus(base), 'rejected_simulation')
    assert.equal(
      preparedToAuditStatus({ ...base, blockReason: 'Token exposure would exceed 2 SOL' }),
      'rejected_capital',
    )
    assert.equal(preparedToAuditStatus({ ...base, allowed: true, blockReason: undefined }), 'in_progress')
  })
})
