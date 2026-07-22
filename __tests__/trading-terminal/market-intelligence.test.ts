import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildMarketIntelligence } from '../../lib/trading-terminal/market-intelligence'
import { resetDemoSeedCache } from '../../lib/trading-terminal/data/demo-seed'

describe('market-intelligence', () => {
  it('builds demo desk with sample pulse, feed, heatmap', () => {
    resetDemoSeedCache()
    const b = buildMarketIntelligence('demo', null)
    assert.equal(b.mode, 'demo')
    assert.equal(b.sample, true)
    assert.equal(b.pulse.length, 6)
    assert.ok(b.feed.length >= 1)
    assert.ok(b.heatmap.length >= 1)
    assert.ok(b.status.some((s) => s.id === 'sol'))
    assert.ok(b.status.some((s) => s.id === 'fng'))
    assert.ok(b.pulse.every((p) => p.sample === true))
    assert.ok(b.heatmap.every((h) => h.sample === true))
  })

  it('live mode does not fabricate pulse or heatmap cells', () => {
    const b = buildMarketIntelligence('live', {
      solUsd: 150,
      solChangePct: 1.2,
      btcUsd: 100_000,
      btcChangePct: 0.5,
      ethUsd: 3500,
      ethChangePct: -0.2,
      fearGreed: 64,
      fearGreedLabel: 'Greed',
      marketCapUsd: 2.5e12,
      marketCapChangePct: 0.8,
      tps: 1200,
      activeWallets: null,
      source: 'test',
    })
    assert.equal(b.mode, 'live')
    assert.equal(b.sample, false)
    assert.equal(b.feed.length, 0)
    assert.equal(b.heatmap.length, 0)
    assert.ok(b.pulse.every((p) => p.display === '—' || p.deltaLabel === 'awaiting feed'))
    const sol = b.status.find((s) => s.id === 'sol')
    assert.equal(sol?.valueNum, 150)
    assert.equal(sol?.sample, false)
  })
})
