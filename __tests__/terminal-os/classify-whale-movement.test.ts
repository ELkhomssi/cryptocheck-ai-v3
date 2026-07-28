/**
 * Unit tests for whale classification — pure function, no UI.
 * Run: node --import tsx --test __tests__/terminal-os/classify-whale-movement.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyWhaleMovement } from '../../features/terminal-os/shared/lib/classify-whale-movement'

describe('classifyWhaleMovement', () => {
  it('returns High Conviction Buy for large buy', () => {
    const c = classifyWhaleMovement({
      action: 'buy',
      usdValue: 500_000,
    })
    assert.equal(c, 'High Conviction Buy')
  })

  it('returns Accumulation for smaller buy', () => {
    const c = classifyWhaleMovement({
      action: 'buy',
      usdValue: 10_000,
    })
    assert.equal(c, 'Accumulation')
  })

  it('flags Possible Rug for known-dev sell', () => {
    const c = classifyWhaleMovement({
      action: 'sell',
      usdValue: 80_000,
      isKnownDevWallet: true,
    })
    assert.equal(c, 'Possible Rug')
  })

  it('respects explicit upstream classification', () => {
    const c = classifyWhaleMovement({
      action: 'swap',
      usdValue: 1,
      classification: 'Exit Signal',
    })
    assert.equal(c, 'Exit Signal')
  })
})
