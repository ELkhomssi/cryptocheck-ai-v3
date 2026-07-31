import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeBuilderState,
  defaultSlippageBpsFromLiquidity,
  expectedLossUsd,
  expectedProfitUsd,
  positionSizeUnits,
  riskPct,
  riskRewardRatio,
  totalEstimatedCostUsd,
} from '../../features/execution-desk/lib/builder-math'
import { computeMevProtection } from '../../features/execution-desk/lib/mev-score'

describe('execution-desk builder math', () => {
  it('computes position size, RR, costs from explicit formulas', () => {
    assert.equal(positionSizeUnits(100, 2), 50)
    assert.equal(riskPct('buy', 10, 9), 10)
    assert.equal(riskRewardRatio('buy', 10, 9, 12), 2)
    assert.equal(expectedProfitUsd('buy', 50, 10, 12), 100)
    assert.equal(expectedLossUsd('buy', 50, 10, 9), 50)
    assert.equal(totalEstimatedCostUsd(100, 0.5, 0.25, 100), 100 + 0.5 + 0.25 + 1)

    const state = computeBuilderState({
      wallet: 'w',
      token: { mint: 'm', symbol: 'T', chain: 'solana' },
      side: 'buy',
      orderType: 'market',
      amountUsd: 100,
      slippageToleranceBps: 100,
      gasEstimateUsd: 0.5,
      priorityFeeUsd: 0.25,
      currentPrice: 2,
      stopLoss: 1.8,
      takeProfit: 2.4,
    })
    assert.equal(state.positionSizeUnits, 50)
    assert.ok(state.riskRewardRatio != null && Math.abs(state.riskRewardRatio - 2) < 1e-9)
    assert.equal(state.totalEstimatedCostUsd, 101.75)
  })

  it('defaults slippage from liquidity depth', () => {
    assert.equal(defaultSlippageBpsFromLiquidity(10_000), 200)
    assert.equal(defaultSlippageBpsFromLiquidity(2_000_000), 50)
  })
})

describe('mev protection score', () => {
  it('raises risk when order is large vs pool and prefers jito when enabled', () => {
    const v = computeMevProtection({
      amountUsd: 5_000,
      liquidityUsd: 50_000,
      slotLagMs: 1500,
      jitoEnabled: true,
      chain: 'solana',
    })
    assert.ok(v.riskScore >= 40)
    assert.equal(v.route, 'jito_private')
    assert.ok(v.tipLamports > 0)
  })

  it('falls back to priority_fee when jito is disabled', () => {
    const v = computeMevProtection({
      amountUsd: 500,
      liquidityUsd: 50_000,
      slotLagMs: 1500,
      jitoEnabled: false,
      chain: 'solana',
    })
    assert.equal(v.route, 'priority_fee')
    assert.equal(v.tipLamports, 0)
  })
})
