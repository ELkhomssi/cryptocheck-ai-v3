import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resetDemoSeedCache } from '../../lib/trading-terminal/data/demo-seed'
import {
  buildPortfolioIntelligence,
  formatPortPct,
  formatPortUsdSigned,
} from '../../lib/trading-terminal/portfolio-intelligence'

describe('buildPortfolioIntelligence', () => {
  it('demo desk is sample-tagged with summary, allocations, risk, alignment, insights', () => {
    resetDemoSeedCache()
    const bundle = buildPortfolioIntelligence('demo')
    assert.equal(bundle.mode, 'demo')
    assert.equal(bundle.sample, true)
    assert.ok(bundle.summary.totalValueUsd > 0)
    assert.ok(bundle.summary.holdingsCount >= 4)
    assert.ok(bundle.summary.sample)
    assert.ok(bundle.holdings.every((h) => h.sample))
    assert.ok(bundle.allocations.sector.length >= 2)
    assert.ok(bundle.allocations.risk.length >= 1)
    assert.ok(bundle.allocations.liquidity.length >= 1)
    assert.ok(bundle.risk.portfolioRiskScore >= 0 && bundle.risk.portfolioRiskScore <= 100)
    assert.ok(bundle.alignment.alignmentScore > 0)
    assert.ok(bundle.hiddenRisks.length >= 2)
    assert.ok(bundle.hiddenRisks.some((f) => f.severity === 'CRITICAL' || f.severity === 'WARNING'))
    assert.ok(bundle.insights.strengths.length > 0)
    assert.ok(bundle.insights.suggestedActions.length > 0)
    assert.notEqual(bundle.insights.healthLabel, 'Unavailable')
  })

  it('live desk is honest empty awaiting wallet', () => {
    const bundle = buildPortfolioIntelligence('live')
    assert.equal(bundle.mode, 'live')
    assert.equal(bundle.sample, false)
    assert.equal(bundle.summary.totalValueUsd, 0)
    assert.equal(bundle.holdings.length, 0)
    assert.equal(bundle.hiddenRisks.length, 0)
    assert.equal(bundle.risk.portfolioRiskScore, 0)
    assert.equal(bundle.insights.healthLabel, 'Unavailable')
    assert.ok(bundle.liveNote)
    assert.match(bundle.methodNote, /awaiting|live/i)
  })
})

describe('portfolio formatters', () => {
  it('formats signed pnl', () => {
    assert.equal(formatPortUsdSigned(1248), '+$1.2k')
    assert.equal(formatPortPct(-12.4), '−12.4%')
  })
})
