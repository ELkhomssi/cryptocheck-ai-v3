import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resetDemoSeedCache } from '../../lib/trading-terminal/data/demo-seed'
import {
  buildWhaleIntelligence,
  cohortLabel,
  formatUsdSigned,
  formatWhaleTime,
} from '../../lib/trading-terminal/whale-intelligence'

describe('buildWhaleIntelligence', () => {
  it('demo desk is sample-tagged with all cohorts and consensus meters', () => {
    resetDemoSeedCache()
    const bundle = buildWhaleIntelligence('demo')
    assert.equal(bundle.mode, 'demo')
    assert.equal(bundle.sample, true)
    assert.equal(bundle.cohorts.length, 5)
    assert.ok(bundle.wallets.length >= 8)
    assert.ok(bundle.wallets.every((w) => w.sample === true))
    assert.ok(bundle.nodes.some((n) => n.kind === 'wallet'))
    assert.ok(bundle.nodes.some((n) => n.kind === 'token'))
    assert.ok(bundle.nodes.some((n) => n.kind === 'dex'))
    assert.ok(bundle.nodes.some((n) => n.kind === 'pool'))
    assert.ok(bundle.edges.length >= 5)
    assert.ok(bundle.feed.length >= 5)
    const types = new Set(bundle.feed.map((f) => f.type))
    assert.ok(types.has('BUY'))
    assert.ok(types.has('ACCUMULATION'))
    assert.ok(types.has('DISTRIBUTION'))
    assert.ok(types.has('INSIDER_SIGNAL'))
    assert.ok(types.has('LIQUIDITY_MOVE'))
    assert.ok(bundle.consensus.smartMoneyScore > 0)
    assert.ok(bundle.consensus.sample)
    assert.equal(cohortLabel('smart_money'), 'Smart Money Wallets')
  })

  it('live desk is honest empty awaiting feeds', () => {
    const bundle = buildWhaleIntelligence('live')
    assert.equal(bundle.mode, 'live')
    assert.equal(bundle.sample, false)
    assert.equal(bundle.wallets.length, 0)
    assert.equal(bundle.nodes.length, 0)
    assert.equal(bundle.edges.length, 0)
    assert.equal(bundle.feed.length, 0)
    assert.equal(bundle.consensus.smartMoneyScore, 0)
    assert.equal(bundle.consensus.sample, false)
    assert.match(bundle.consensus.summary, /awaiting|offline|connect/i)
  })
})

describe('whale formatters', () => {
  it('formats signed usd and utc time', () => {
    assert.equal(formatUsdSigned(182_000), '+$182.0k')
    assert.equal(formatUsdSigned(-4100), '−$4.1k')
    assert.equal(formatWhaleTime('2026-07-22T20:15:33.000Z'), '20:15:33')
  })
})
