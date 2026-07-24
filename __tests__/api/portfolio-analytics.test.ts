import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyFifoLots,
  computeHhi,
  logReturns,
  pearsonCorrelation,
  type FifoFill,
} from '../../lib/terminal/portfolio-math'

describe('applyFifoLots', () => {
  it('computes realized PnL and remaining avg entry from synthetic lots', () => {
    const mint = 'TokenMint111111111111111111111111111111111'
    const fills: FifoFill[] = [
      { mint, side: 'buy', qty: 10, priceUsd: 1.0, ts: 1 },
      { mint, side: 'buy', qty: 10, priceUsd: 2.0, ts: 2 },
      // sell 10 should consume first lot @ $1 → realize (3-1)*10 = 20
      { mint, side: 'sell', qty: 10, priceUsd: 3.0, ts: 3 },
    ]

    const result = applyFifoLots(fills)
    const row = result.get(mint)
    assert.ok(row)
    assert.equal(row!.realizedPnlUsd, 20)
    assert.equal(row!.remainingQty, 10)
    assert.equal(row!.avgEntryPriceUsd, 2)
    assert.equal(row!.closedTrades, 1)
    assert.equal(row!.winningTrades, 1)
  })

  it('splits a sell across multiple FIFO lots', () => {
    const mint = 'TokenMint222222222222222222222222222222222'
    const fills: FifoFill[] = [
      { mint, side: 'buy', qty: 5, priceUsd: 1, ts: 1 },
      { mint, side: 'buy', qty: 5, priceUsd: 3, ts: 2 },
      // sell 8 @ 2: 5*(2-1) + 3*(2-3) = 5 - 3 = 2
      { mint, side: 'sell', qty: 8, priceUsd: 2, ts: 3 },
    ]
    const row = applyFifoLots(fills).get(mint)!
    assert.equal(row.realizedPnlUsd, 2)
    assert.equal(row.remainingQty, 2)
    assert.ok(Math.abs((row.avgEntryPriceUsd ?? 0) - 3) < 1e-9)
  })

  it('ignores unmatched sells beyond available lots (no fabricated short PnL)', () => {
    const mint = 'TokenMint333333333333333333333333333333333'
    const fills: FifoFill[] = [
      { mint, side: 'buy', qty: 2, priceUsd: 1, ts: 1 },
      { mint, side: 'sell', qty: 10, priceUsd: 5, ts: 2 },
    ]
    const row = applyFifoLots(fills).get(mint)!
    // Only 2 units matched: (5-1)*2 = 8
    assert.equal(row.realizedPnlUsd, 8)
    assert.equal(row.remainingQty, 0)
    assert.equal(row.avgEntryPriceUsd, null)
  })

  it('skips invalid fills', () => {
    const mint = 'TokenMint444444444444444444444444444444444'
    const fills: FifoFill[] = [
      { mint, side: 'buy', qty: 0, priceUsd: 1, ts: 1 },
      { mint, side: 'buy', qty: 5, priceUsd: -1, ts: 2 },
      { mint, side: 'buy', qty: 4, priceUsd: 2, ts: 3 },
    ]
    const row = applyFifoLots(fills).get(mint)!
    assert.equal(row.remainingQty, 4)
    assert.equal(row.avgEntryPriceUsd, 2)
  })
})

describe('computeHhi', () => {
  it('is 1 for a single 100% weight and lower when diversified', () => {
    assert.equal(computeHhi([1]), 1)
    assert.ok(computeHhi([0.5, 0.5]) < 1)
    assert.ok(Math.abs(computeHhi([0.5, 0.5]) - 0.5) < 1e-9)
  })
})

describe('pearsonCorrelation / logReturns', () => {
  it('returns ~1 for identical series and null for short series', () => {
    const closes = [1, 1.1, 1.21, 1.331]
    const r = logReturns(closes)
    assert.equal(pearsonCorrelation(r, r), 1)
    assert.equal(pearsonCorrelation([1, 2], [2, 3]), null)
  })
})
