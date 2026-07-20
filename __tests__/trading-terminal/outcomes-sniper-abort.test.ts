import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pickMarkFromDexPayload } from '@/lib/trading-terminal/mark-price'
import { computeTradeOutcome, summarizeOutcomes } from '@/lib/trading-terminal/trade-outcomes'
import { evaluateSniperAbort } from '@/lib/trading-terminal/sniper-abort'
import { defaultSniperState } from '@/lib/trading-terminal/sniper-state'
import type { TerminalTradeEntry } from '@/lib/trading-terminal/trade-log'

const MINT = 'So11111111111111111111111111111111111111112'

function trade(over: Partial<TerminalTradeEntry> = {}): TerminalTradeEntry {
  return {
    at: '2026-07-21T12:00:00.000Z',
    mint: MINT,
    symbol: 'SOL',
    side: 'buy',
    signature: 'sig'.padEnd(64, 'x'),
    entryPriceUsd: 100,
    verdictAtTrade: 'SAFE',
    coachOverridden: false,
    ...over,
  }
}

describe('pickMarkFromDexPayload', () => {
  it('returns null without pairs', () => {
    assert.equal(pickMarkFromDexPayload(MINT, { pairs: [] }), null)
  })

  it('picks highest liquidity pair', () => {
    const q = pickMarkFromDexPayload(MINT, {
      pairs: [
        { priceUsd: '1', liquidity: { usd: 100 } },
        { priceUsd: '2', liquidity: { usd: 5000 } },
      ],
    })
    assert.ok(q)
    assert.equal(q.priceUsd, 2)
    assert.equal(q.liquidityUsd, 5000)
  })
})

describe('computeTradeOutcome', () => {
  it('withholds without entry', () => {
    const o = computeTradeOutcome(trade({ entryPriceUsd: undefined }), 110)
    assert.equal(o.status, 'unavailable')
    assert.equal(o.priceDeltaPct, null)
  })

  it('buy Δ from marks', () => {
    const o = computeTradeOutcome(trade({ side: 'buy', entryPriceUsd: 100 }), 110)
    assert.equal(o.status, 'marked')
    assert.ok(o.priceDeltaPct != null && Math.abs(o.priceDeltaPct - 10) < 0.01)
  })

  it('sell Δ from marks', () => {
    const o = computeTradeOutcome(trade({ side: 'sell', entryPriceUsd: 100 }), 90)
    assert.equal(o.status, 'marked')
    assert.ok(o.priceDeltaPct != null && Math.abs(o.priceDeltaPct - (100 / 90 - 1) * 100) < 0.01)
  })
})

describe('summarizeOutcomes', () => {
  it('averages marked only', () => {
    const rows = [
      computeTradeOutcome(trade({ entryPriceUsd: 100 }), 110),
      computeTradeOutcome(trade({ entryPriceUsd: undefined, signature: 'y'.padEnd(64, 'y') }), 110),
    ]
    const s = summarizeOutcomes(rows)
    assert.equal(s.marked, 1)
    assert.equal(s.unavailable, 1)
    assert.ok(s.avgDeltaPct != null && Math.abs(s.avgDeltaPct - 10) < 0.01)
  })
})

describe('evaluateSniperAbort', () => {
  const armed = {
    ...defaultSniperState(),
    armed: true,
    mint: MINT,
    maxRiskScore: 70,
    riskAck: true,
  }

  it('ok when within rails', () => {
    const r = evaluateSniperAbort({
      state: armed,
      focusMint: MINT,
      riskScore: 40,
      verdict: 'SAFE',
    })
    assert.equal(r.abort, false)
    assert.equal(r.reason, 'ok')
  })

  it('aborts on BLOCKED', () => {
    const r = evaluateSniperAbort({
      state: armed,
      focusMint: MINT,
      riskScore: 90,
      verdict: 'BLOCKED',
    })
    assert.equal(r.abort, true)
    assert.equal(r.reason, 'blocked')
  })

  it('aborts on risk threshold', () => {
    const r = evaluateSniperAbort({
      state: armed,
      focusMint: MINT,
      riskScore: 75,
      verdict: 'HIGH_RISK',
    })
    assert.equal(r.abort, true)
    assert.equal(r.reason, 'risk_threshold')
  })

  it('aborts on mint mismatch', () => {
    const r = evaluateSniperAbort({
      state: armed,
      focusMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      riskScore: 10,
      verdict: 'SAFE',
    })
    assert.equal(r.abort, true)
    assert.equal(r.reason, 'mint_mismatch')
  })
})
