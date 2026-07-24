import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { TokenMarketMetrics } from '../../lib/providers/types'
import {
  computeAiScore,
  computeRiskScore,
  computeSmartMoneyScore,
} from '../../lib/terminal/scoring'

function metrics(partial: Partial<TokenMarketMetrics>): TokenMarketMetrics {
  return {
    mint: 'So11111111111111111111111111111111111111112',
    priceUsd: 1,
    change5mPct: 0,
    change1hPct: 0,
    change24hPct: 0,
    volume24hUsd: 0,
    liquidityUsd: 0,
    marketCapUsd: 0,
    fdvUsd: 0,
    holders: 0,
    txCount24h: 0,
    buySellRatio: 1,
    ...partial,
  }
}

describe('computeRiskScore', () => {
  it('scores thin liquidity + volatility as high risk', () => {
    const score = computeRiskScore(
      metrics({
        liquidityUsd: 5_000,
        change24hPct: 60,
        change5mPct: 25,
        holders: 20,
      }),
    )
    assert.equal(score, 100)
  })

  it('scores deep liquidity + calm markets as low risk', () => {
    const score = computeRiskScore(
      metrics({
        liquidityUsd: 5_000_000,
        change24hPct: 1,
        change5mPct: 0.2,
        holders: 50_000,
      }),
    )
    assert.ok(score <= 10)
  })

  it('clamps to 0–100', () => {
    const score = computeRiskScore(
      metrics({
        liquidityUsd: 1,
        change24hPct: 999,
        change5mPct: 999,
        holders: 1,
      }),
    )
    assert.ok(score >= 0 && score <= 100)
  })
})

describe('computeAiScore', () => {
  it('rewards volume, liquidity, holders, and activity', () => {
    const weak = computeAiScore(
      metrics({ volume24hUsd: 100, liquidityUsd: 1_000, holders: 10, txCount24h: 2 }),
    )
    const strong = computeAiScore(
      metrics({
        volume24hUsd: 8_000_000,
        liquidityUsd: 4_000_000,
        holders: 40_000,
        txCount24h: 2_000,
      }),
    )
    assert.ok(strong > weak)
    assert.ok(strong >= 80)
    assert.ok(weak < 40)
  })

  it('returns 0 for empty metrics', () => {
    assert.equal(computeAiScore(metrics({})), 0)
  })

  it('clamps to 0–100', () => {
    const score = computeAiScore(
      metrics({
        volume24hUsd: 1e15,
        liquidityUsd: 1e15,
        holders: 1e9,
        txCount24h: 1e9,
      }),
    )
    assert.equal(score, 100)
  })
})

describe('computeSmartMoneyScore', () => {
  it('maps buy/sell ratio to 0–100', () => {
    assert.equal(computeSmartMoneyScore(metrics({ buySellRatio: 2 })), 100)
    assert.equal(computeSmartMoneyScore(metrics({ buySellRatio: 1 })), 50)
    assert.equal(computeSmartMoneyScore(metrics({ buySellRatio: 0.5 })), 0)
  })
})
