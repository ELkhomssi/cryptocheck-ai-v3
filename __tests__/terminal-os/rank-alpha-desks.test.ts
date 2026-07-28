/**
 * Unit tests for alpha-desk ranking algorithm.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rankAlphaDesks } from '../../features/terminal-os/shared/lib/rank-alpha-desks'

describe('rankAlphaDesks', () => {
  it('ranks higher 24h performers ahead of laggards', () => {
    const out = rankAlphaDesks(
      [
        {
          id: 'a',
          symbol: 'aaa',
          price_change_percentage_24h: 2,
          total_volume: 1e9,
          market_cap: 5e9,
        },
        {
          id: 'b',
          symbol: 'bbb',
          price_change_percentage_24h: 40,
          total_volume: 2e9,
          market_cap: 4e9,
        },
      ],
      2,
    )
    assert.equal(out[0]?.id, 'b')
    assert.equal(out[0]?.underlyingSymbol, 'BBB')
    assert.ok((out[0]?.pnlPct ?? 0) > (out[1]?.pnlPct ?? 0))
  })

  it('assigns stable personas and rich fields', () => {
    const out = rankAlphaDesks(
      [
        {
          id: 'solana',
          symbol: 'sol',
          image: 'https://example.com/sol.png',
          price_change_percentage_24h: 12,
          total_volume: 3e9,
          current_price: 100,
          market_cap: 40e9,
        },
      ],
      1,
    )
    assert.equal(out.length, 1)
    assert.ok(out[0]!.handle.length > 2)
    assert.ok(out[0]!.winRatePct >= 42 && out[0]!.winRatePct <= 91)
    assert.ok(out[0]!.aiConfidence >= 62)
    assert.equal(out[0]!.underlyingSymbol, 'SOL')
    // stable across calls
    const again = rankAlphaDesks(
      [
        {
          id: 'solana',
          symbol: 'sol',
          price_change_percentage_24h: 12,
          total_volume: 3e9,
        },
      ],
      1,
    )
    assert.equal(again[0]!.handle, out[0]!.handle)
  })
})
