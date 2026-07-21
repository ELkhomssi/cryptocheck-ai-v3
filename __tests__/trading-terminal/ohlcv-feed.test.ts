import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildDemoSeed, resetDemoSeedCache } from '../../lib/trading-terminal/data/demo-seed'
import {
  fetchLiveOhlcv,
  mapDemoSeedCandles,
  summarizeCandles,
} from '../../lib/trading-terminal/ohlcv-feed'

describe('ohlcv-feed', () => {
  it('summarizeCandles computes last + session change', () => {
    const s = summarizeCandles([
      { time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1 },
      { time: 2, open: 105, high: 120, low: 100, close: 110, volume: 2 },
    ])
    assert.equal(s.lastPrice, 110)
    assert.equal(s.changePct, 10)
  })

  it('summarizeCandles handles empty', () => {
    const s = summarizeCandles([])
    assert.equal(s.lastPrice, 0)
    assert.equal(s.changePct, 0)
  })

  it('mapDemoSeedCandles converts ms → unix seconds', () => {
    resetDemoSeedCache()
    const seed = buildDemoSeed(1_700_000_000_000)
    const chart = seed.charts[0]!
    const candles = mapDemoSeedCandles(chart.candles)
    assert.ok(candles.length >= 20)
    assert.ok(candles[0]!.time < 1e12, 'time should be seconds not ms')
    assert.ok(candles.every((c) => c.high >= c.low))
    const sum = summarizeCandles(candles)
    assert.ok(sum.lastPrice > 0)
  })

  it('fetchLiveOhlcv rejects demo mints honestly', async () => {
    const r = await fetchLiveOhlcv({
      mint: 'DemoDogeAi2222222222222222222222222222222',
      symbol: 'DOGEAI',
      timeframe: '5m',
    })
    assert.equal(r.status, 'unavailable')
  })

  it('fetchLiveOhlcv rejects short mints', async () => {
    const r = await fetchLiveOhlcv({
      mint: 'abc',
      symbol: 'X',
      timeframe: '5m',
    })
    assert.equal(r.status, 'unavailable')
  })
})
