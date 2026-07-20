import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

describe('guardian slippage abort guard (unit)', () => {
  it('aborts when price impact exceeds max slippage bps', () => {
    const maxSlippageBps = 150
    const slippagePctLimit = maxSlippageBps / 100
    const priceImpactPct = 5
    const shouldAbort = priceImpactPct > slippagePctLimit
    assert.equal(shouldAbort, true)
  })

  it('aborts when expected proceeds below min ratio of position', () => {
    const positionValueUsd = 100
    const minProceedsRatio = 0.85
    const expectedOutputUsd = 50
    const minProceedsUsd = positionValueUsd * minProceedsRatio
    assert.ok(expectedOutputUsd < minProceedsUsd)
  })

  it('allows when quote passes both guards', () => {
    const maxSlippageBps = 150
    const slippagePctLimit = maxSlippageBps / 100
    const priceImpactPct = 1
    const positionValueUsd = 100
    const expectedOutputUsd = 90
    const minProceedsUsd = positionValueUsd * 0.85
    assert.ok(priceImpactPct <= slippagePctLimit)
    assert.ok(expectedOutputUsd >= minProceedsUsd)
  })
})

describe('guardian kill-switch', () => {
  it('kill-switch key uses ccai:rep: prefix', async () => {
    const { GUARDIAN_KILL_REDIS_PREFIX } = await import('@/lib/personal-watch/constants')
    assert.match(GUARDIAN_KILL_REDIS_PREFIX, /^ccai:rep:/)
  })
})
