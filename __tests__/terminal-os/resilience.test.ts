/**
 * Resilience layer unit tests (pure circuit / envelope shape).
 * Run: node --import tsx --test __tests__/terminal-os/resilience.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_TICKER, DEMO_TOKENS, demoWhales } from '../../lib/terminal-os/demo-dataset'

describe('Terminal OS demo dataset', () => {
  it('has labeled major tickers for demo insurance', () => {
    assert.ok(DEMO_TICKER.length >= 4)
    assert.ok(DEMO_TICKER.every((t) => t.priceUsd > 0))
  })

  it('has multi-chain tokens', () => {
    const chains = new Set(DEMO_TOKENS.map((t) => t.chain))
    assert.ok(chains.has('solana'))
    assert.ok(chains.has('ethereum') || chains.has('base'))
  })

  it('demo whales are enriched with confidence/impact', () => {
    const w = demoWhales()
    assert.ok(w.length >= 2)
    assert.ok(w.every((x) => x.aiConfidence > 0 && x.impactScore > 0))
    assert.ok(w.every((x) => x.sample === true || x.walletFull.length > 0))
  })
})
