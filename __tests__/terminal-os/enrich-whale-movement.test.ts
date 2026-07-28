/**
 * Unit tests for whale marquee enrichment — pure functions, no UI.
 * Run: node --import tsx --test __tests__/terminal-os/enrich-whale-movement.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyWhaleMovement } from '../../features/terminal-os/shared/lib/classify-whale-movement'
import {
  WHALE_HIGH_CONFIDENCE_MIN,
  computeAiConfidence,
  computeImpactScore,
  enrichWhaleMovement,
  filterHighConfidenceWhales,
  mergeWhaleRing,
  truncateWallet,
  whaleDisplayAction,
} from '../../features/terminal-os/shared/lib/enrich-whale-movement'

describe('enrich-whale-movement', () => {
  it('truncates wallet addresses', () => {
    assert.equal(truncateWallet('abcdefghijklmnop'), 'abcd…mnop')
  })

  it('maps Possible Rug to ALERT display', () => {
    assert.equal(whaleDisplayAction('sell', 'Possible Rug'), 'ALERT')
    assert.equal(whaleDisplayAction('buy', 'Accumulation'), 'BUY')
    assert.equal(whaleDisplayAction('swap', 'Liquidity Migration'), 'SWAP')
    assert.equal(whaleDisplayAction('transfer', 'Liquidity Migration'), 'TRANSFER')
  })

  it('computes impact and confidence in range', () => {
    const impact = computeImpactScore(2_500_000, 10_000_000)
    assert.ok(impact >= 8 && impact <= 100)
    const conf = computeAiConfidence({
      usdValue: 2_500_000,
      volume24hUsd: 20_000_000,
      classification: 'High Conviction Buy',
    })
    assert.ok(conf >= 70)
  })

  it('enriches without fabricating attribution by default', () => {
    const w = enrichWhaleMovement(
      {
        id: 't1',
        walletFull: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        chain: 'solana',
        action: 'buy',
        assetSymbol: 'SOL',
        usdValue: 3_000_000,
        amount: 20_000,
        occurredAt: new Date().toISOString(),
        volume24hUsd: 40_000_000,
        liquidityUsd: 12_000_000,
      },
      classifyWhaleMovement,
    )
    assert.equal(w.previousHoldingsUsd, null)
    assert.equal(w.pnlUsd, null)
    assert.ok(w.aiConfidence >= 70)
    assert.ok(w.impactScore > 0)
    assert.ok(w.aiReasoning.length > 20)
    assert.equal(w.sample, undefined)
  })

  it('tags sample attribution when requested', () => {
    const w = enrichWhaleMovement(
      {
        id: 't2',
        walletFull: '0xabc123',
        chain: 'ethereum',
        action: 'sell',
        assetSymbol: 'ETH',
        usdValue: 1_000_000,
        amount: 300,
        occurredAt: new Date().toISOString(),
        sampleAttribution: true,
      },
      classifyWhaleMovement,
    )
    assert.equal(w.sample, true)
    assert.ok(w.previousHoldingsUsd != null)
  })

  it('merges ring buffer and filters high confidence', () => {
    const a = enrichWhaleMovement(
      {
        id: 'a',
        walletFull: 'aaaa',
        chain: 'base',
        action: 'buy',
        assetSymbol: 'DEGEN',
        usdValue: 5_000_000,
        amount: 1,
        occurredAt: new Date(Date.now() - 1000).toISOString(),
        volume24hUsd: 50_000_000,
      },
      classifyWhaleMovement,
    )
    const b = enrichWhaleMovement(
      {
        id: 'b',
        walletFull: 'bbbb',
        chain: 'bnb',
        action: 'swap',
        assetSymbol: 'BNB',
        usdValue: 1_000,
        amount: 1,
        occurredAt: new Date().toISOString(),
      },
      classifyWhaleMovement,
    )
    const merged = mergeWhaleRing([a], [b, { ...a, usdValue: 6_000_000 }])
    assert.equal(merged.length, 2)
    const hi = filterHighConfidenceWhales(merged)
    assert.ok(hi.every((w) => w.aiConfidence >= WHALE_HIGH_CONFIDENCE_MIN))
  })
})
