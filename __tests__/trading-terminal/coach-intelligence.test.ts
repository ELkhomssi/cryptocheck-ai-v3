import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildCoachAction } from '../../lib/trading-terminal/coach-action'
import { buildCoachTradePlan } from '../../lib/trading-terminal/coach-trade-plan'
import { computePortfolioImpact } from '../../lib/trading-terminal/portfolio-impact'
import { loadSimilarSetups } from '../../lib/trading-terminal/similar-setups'
import { MOCK_ONLY as sparkMock } from '../../lib/trading-terminal/mocks/market-sparklines.mock'
import { mockSparkline } from '../../lib/trading-terminal/mocks/market-sparklines.mock'

describe('buildCoachAction', () => {
  it('returns null without verdict', () => {
    assert.equal(
      buildCoachAction({ verdict: null, riskScore: null, why: [], risks: [] }),
      null,
    )
  })

  it('blocks on BLOCKED', () => {
    const a = buildCoachAction({
      verdict: 'BLOCKED',
      riskScore: 90,
      why: [],
      risks: [],
    })
    assert.ok(a)
    assert.ok(a!.ruleIds.includes('blocked_hard'))
    assert.match(a!.interpretation, /Do not trade/)
  })

  it('cautions monitor on CAUTION', () => {
    const a = buildCoachAction({
      verdict: 'CAUTION',
      riskScore: 50,
      why: [{ text: 'liq ok', source: 'x' }],
      risks: [],
    })
    assert.ok(a!.ruleIds.includes('caution_monitor'))
  })
})

describe('buildCoachTradePlan', () => {
  it('insufficient without verdict', () => {
    const p = buildCoachTradePlan({
      verdict: null,
      riskScore: null,
      safetyScore: null,
      markPriceUsd: null,
      liquidityUsd: null,
      volatilityPct: null,
      portfolioTotalUsd: 1000,
      ticketAmountSol: 1,
      solPriceUsd: 100,
    })
    assert.equal(p.insufficient, true)
    assert.equal(p.takeProfitTargets.length, 0)
  })

  it('omits TP when no mark price', () => {
    const p = buildCoachTradePlan({
      verdict: 'SAFE',
      riskScore: 20,
      safetyScore: 80,
      markPriceUsd: null,
      liquidityUsd: null,
      volatilityPct: null,
      portfolioTotalUsd: 10_000,
      ticketAmountSol: 0.5,
      solPriceUsd: 150,
    })
    assert.equal(p.insufficient, false)
    assert.equal(p.takeProfitTargets.length, 0)
    assert.ok(p.suggestedPositionSize)
    assert.equal(p.riskLevel, 'LOW')
  })

  it('blocked plan has zero size', () => {
    const p = buildCoachTradePlan({
      verdict: 'BLOCKED',
      riskScore: 95,
      safetyScore: 5,
      markPriceUsd: 0.01,
      liquidityUsd: 1000,
      volatilityPct: 40,
      portfolioTotalUsd: 5000,
      ticketAmountSol: 1,
      solPriceUsd: 100,
    })
    assert.equal(p.riskLevel, 'EXTREME')
    assert.match(p.suggestedPositionSize || '', /0%/)
  })
})

describe('computePortfolioImpact', () => {
  it('awaits without portfolio', () => {
    const i = computePortfolioImpact({
      portfolioTotalUsd: 0,
      currentPositionUsd: 0,
      ticketUsd: 100,
      side: 'buy',
    })
    assert.equal(i.awaiting, true)
  })

  it('projects after buy', () => {
    const i = computePortfolioImpact({
      portfolioTotalUsd: 1000,
      currentPositionUsd: 100,
      ticketUsd: 200,
      side: 'buy',
    })
    assert.equal(i.awaiting, false)
    assert.ok(i.beforePct != null && Math.abs(i.beforePct - 10) < 0.01)
    assert.ok(i.afterPct != null && i.afterPct > i.beforePct!)
  })
})

describe('similar setups gate', () => {
  it('defaults to insufficient', () => {
    const s = loadSimilarSetups()
    assert.equal(s.insufficient, true)
  })
})

describe('MOCK_ONLY sparklines', () => {
  it('is tagged and deterministic', () => {
    assert.equal(sparkMock, true)
    const a = mockSparkline(7)
    const b = mockSparkline(7)
    assert.equal(a.length, 24)
    assert.deepEqual(a, b)
  })
})
