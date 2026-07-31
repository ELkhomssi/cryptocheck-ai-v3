import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeBuilderState } from '../../features/execution-desk/lib/builder-math'
import { computeMevProtection } from '../../features/execution-desk/lib/mev-score'
import type { ExecutionAuditPayload } from '../../features/execution-desk/types'

describe('execution desk audit payload shape', () => {
  it('includes full builder + security gate fields', () => {
    const builder = computeBuilderState({
      wallet: 'Wallet111111111111111111111111111111111',
      token: { mint: 'Mint1111111111111111111111111111111111', symbol: 'T', chain: 'solana' },
      side: 'buy',
      orderType: 'market',
      amountUsd: 250,
      slippageToleranceBps: 100,
      gasEstimateUsd: 0.01,
      priorityFeeUsd: 0.02,
      currentPrice: 1.25,
      stopLoss: 1.1,
      takeProfit: 1.6,
    })
    const payload: ExecutionAuditPayload = {
      builder,
      securityVerdict: 'HIGH_RISK',
      securityRiskScore: 72,
      decisionSnapshot: { action: 'BUY', confidence: 0.61, sourceEngineRef: 'decision-engine' },
      executionState: 'confirmed',
      signature: 'sig',
      at: new Date().toISOString(),
    }
    assert.equal(payload.builder.positionSizeUnits, 200)
    assert.ok(payload.builder.totalEstimatedCostUsd > 250)
    assert.equal(payload.securityVerdict, 'HIGH_RISK')
    assert.equal(payload.decisionSnapshot?.action, 'BUY')
  })
})

describe('execution desk MEV routes', () => {
  it('selects flashbots_protect on EVM when private RPC is enabled', () => {
    const v = computeMevProtection({
      amountUsd: 1_000,
      liquidityUsd: 80_000,
      slotLagMs: 900,
      jitoEnabled: false,
      privateRpcEnabled: true,
      chain: 'evm',
    })
    assert.equal(v.route, 'flashbots_protect')
  })
})
