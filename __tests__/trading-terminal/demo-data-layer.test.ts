import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildDemoSeed, DEMO_SEED_TAG, getDemoSeed, resetDemoSeedCache } from '../../lib/trading-terminal/data/demo-seed'
import { getTerminalSnapshot } from '../../lib/trading-terminal/data/adapters'
import { defaultDataMode } from '../../lib/trading-terminal/data/mode'

describe('DEMO_SEED', () => {
  it('is tagged and internally consistent on focus token', () => {
    resetDemoSeedCache()
    const seed = buildDemoSeed(1_700_000_000_000)
    assert.equal(seed.tag, DEMO_SEED_TAG)
    const focus = seed.discover.find((d) => d.mint === seed.focusMint)
    assert.ok(focus)
    assert.equal(focus!.symbol, seed.focusSymbol)
    assert.equal(seed.coach.mint, seed.focusMint)
    assert.equal(seed.coach.symbol, seed.focusSymbol)
    assert.equal(seed.coach.recommended.symbol, 'SOLCAT')
    assert.equal(seed.coach.recommended.side, 'BUY')
    assert.equal(seed.coach.recommended.convictionScore, 92)
    assert.equal(seed.coach.actionQueue[0]?.type, 'BUY')
    assert.ok(seed.coach.riskAnalysis.concentration)
    assert.ok(seed.coach.why.length <= 5)
    assert.ok(seed.coach.opportunities.every((o) => o.conviction > 0))
    const chart = seed.charts.find((c) => c.mint === seed.focusMint)
    assert.ok(chart)
    assert.ok(chart!.candles.length >= 20)
    assert.ok(seed.intel.every((e) => !/telegram/i.test(e.headline)))
    assert.ok(seed.intel.length >= 4)
  })

  it('getDemoSeed is stable within session', () => {
    resetDemoSeedCache()
    const a = getDemoSeed()
    const b = getDemoSeed()
    assert.equal(a.seed, b.seed)
    assert.equal(a.focusMint, b.focusMint)
  })
})

describe('adapters', () => {
  it('demo snapshot fills every panel ready', () => {
    resetDemoSeedCache()
    const snap = getTerminalSnapshot('demo')
    assert.equal(snap.mode, 'demo')
    assert.equal(snap.discover.status, 'ready')
    assert.equal(snap.coach.status, 'ready')
    assert.equal(snap.intel.status, 'ready')
    assert.equal(snap.marketStats.status, 'ready')
    assert.equal(snap.charts.status, 'ready')
    if (snap.charts.status === 'ready') {
      assert.equal(snap.charts.data.length, 6)
      assert.ok(snap.charts.data.every((c) => c.candles.length >= 20))
    }
    if (snap.marketStats.status === 'ready') {
      assert.ok(snap.marketStats.data.every((s) => s.value != null))
    }
  })

  it('live snapshot is honest unavailable without feeds', () => {
    const snap = getTerminalSnapshot('live')
    assert.equal(snap.mode, 'live')
    assert.equal(snap.discover.status, 'unavailable')
    assert.equal(snap.fearGreed.status, 'unavailable')
    assert.ok(snap.liveNote)
  })
})

describe('defaultDataMode', () => {
  it('returns demo or live string', () => {
    const m = defaultDataMode()
    assert.ok(m === 'demo' || m === 'live')
  })
})
