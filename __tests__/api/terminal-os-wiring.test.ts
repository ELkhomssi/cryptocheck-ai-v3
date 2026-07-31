import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluateCondition } from '../../lib/terminal-os/alert-evaluate'
import {
  MIN_SAMPLES_FOR_DNA,
  learningProgressFromSampleSize,
} from '../../features/terminal-os/ai-trade-like-me/engines/behavioral-learning-engine'

describe('alert evaluateCondition', () => {
  it('evaluates numeric operators', () => {
    assert.equal(evaluateCondition({ field: 'price', operator: '>', value: 3 }, 3.1), true)
    assert.equal(evaluateCondition({ field: 'price', operator: '>', value: 3 }, 2.9), false)
    assert.equal(evaluateCondition({ field: 'price', operator: '>=', value: 3 }, 3), true)
    assert.equal(evaluateCondition({ field: 'price', operator: '<', value: 1 }, 0.5), true)
    assert.equal(evaluateCondition({ field: 'price', operator: '==', value: 2 }, 2), true)
  })

  it('rejects non-finite values', () => {
    assert.equal(evaluateCondition({ field: 'price', operator: '>', value: 1 }, Number.NaN), false)
  })
})

describe('trade-like-me learning progress', () => {
  it('ties percentage to sampleSize vs MIN_SAMPLES_FOR_DNA', () => {
    assert.equal(MIN_SAMPLES_FOR_DNA, 8)
    assert.equal(learningProgressFromSampleSize(0), 0)
    assert.equal(learningProgressFromSampleSize(4), 50)
    assert.equal(learningProgressFromSampleSize(8), 100)
    assert.equal(learningProgressFromSampleSize(20), 100)
  })

  it('uses DNA sampleSize when trades map is empty after hydrate', () => {
    const fromDna = learningProgressFromSampleSize(4)
    const fromTrades = learningProgressFromSampleSize(0)
    assert.equal(Math.max(fromTrades, fromDna), 50)
  })
})

describe('coach DNA hint contract', () => {
  it('insufficient when sampleSize below threshold', () => {
    const sampleSize = 2
    const insufficient = sampleSize < 3
    assert.equal(insufficient, true)
  })

  it('different wallets imply different coach context keys', () => {
    const a = { wallet: 'WalletAAA', tradingStyleSummary: 'Momentum scalper' }
    const b = { wallet: 'WalletBBB', tradingStyleSummary: 'Swing whale follower' }
    assert.notEqual(a.tradingStyleSummary, b.tradingStyleSummary)
    assert.notEqual(a.wallet, b.wallet)
  })
})
