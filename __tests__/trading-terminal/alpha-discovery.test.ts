import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resetDemoSeedCache } from '../../lib/trading-terminal/data/demo-seed'
import {
  buildAlphaDiscovery,
  categoryLabel,
  formatAlphaPct,
  sortAlphaRows,
} from '../../lib/trading-terminal/alpha-discovery'

describe('buildAlphaDiscovery', () => {
  it('demo desk is sample-tagged with categories, table, narratives, timeline', () => {
    resetDemoSeedCache()
    const bundle = buildAlphaDiscovery('demo')
    assert.equal(bundle.mode, 'demo')
    assert.equal(bundle.sample, true)
    assert.equal(bundle.categories.length, 6)
    assert.ok(bundle.opportunities.length >= 10)
    assert.ok(bundle.opportunities.every((o) => o.sample === true))
    assert.equal(bundle.narratives.length, 6)
    assert.ok(bundle.narratives.every((n) => n.sample === true))
    assert.ok(bundle.timeline.length >= 6)
    const sectors = new Set(bundle.narratives.map((n) => n.id))
    for (const s of ['AI', 'Meme', 'Gaming', 'DeFi', 'RWA', 'Infrastructure']) {
      assert.ok(sectors.has(s as never))
    }
    const mint = bundle.opportunities[0]!.mint
    const reason = bundle.reasoningByMint[mint]
    assert.ok(reason)
    assert.ok(reason!.evidence.length > 0)
    assert.ok(reason!.riskFactors.length > 0)
    assert.ok(reason!.opportunityDrivers.length > 0)
    assert.equal(categoryLabel('early_accumulation'), 'Early Accumulation')
  })

  it('live desk is honest empty awaiting feeds', () => {
    const bundle = buildAlphaDiscovery('live')
    assert.equal(bundle.mode, 'live')
    assert.equal(bundle.sample, false)
    assert.equal(bundle.opportunities.length, 0)
    assert.equal(bundle.timeline.length, 0)
    assert.equal(Object.keys(bundle.reasoningByMint).length, 0)
    assert.ok(bundle.narratives.every((n) => n.liquidityFlow === 0 && !n.sample))
    assert.match(bundle.methodNote, /awaiting|live/i)
  })
})

describe('sortAlphaRows', () => {
  it('sorts by alpha score descending by default path', () => {
    resetDemoSeedCache()
    const rows = buildAlphaDiscovery('demo').opportunities
    const sorted = sortAlphaRows(rows, 'alphaScore', 'desc')
    assert.ok(sorted[0]!.alphaScore >= sorted[1]!.alphaScore)
    assert.equal(formatAlphaPct(12.5), '+12.5%')
    assert.equal(formatAlphaPct(-3.2), '−3.2%')
  })
})
