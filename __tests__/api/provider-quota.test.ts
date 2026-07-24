import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  chunkArray,
  getProviderQuotaConfig,
  softDelayForTest,
} from '../../lib/providers/quota-test-helpers'

describe('provider quota helpers', () => {
  it('chunks arrays for batched upstream calls', () => {
    assert.deepEqual(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
    assert.deepEqual(chunkArray([], 10), [])
    assert.deepEqual(chunkArray([1], 50), [[1]])
  })

  it('exposes positive default RPM / daily quotas per provider', () => {
    for (const id of [
      'birdeye',
      'jupiter',
      'helius',
      'coingecko',
      'raydium',
      'dexscreener',
      'anthropic',
    ] as const) {
      const cfg = getProviderQuotaConfig(id)
      assert.ok(cfg.rpm > 0, `${id} rpm`)
      assert.ok(cfg.daily > 0, `${id} daily`)
      assert.ok(cfg.softRatio > 0 && cfg.softRatio < 1, `${id} softRatio`)
    }
  })

  it('soft delay is 0 under soft threshold and rises toward max', () => {
    assert.equal(softDelayForTest(10, 100, 0.75, 2000), 0)
    assert.ok(softDelayForTest(80, 100, 0.75, 2000) > 0)
    assert.equal(softDelayForTest(100, 100, 0.75, 2000), 2000)
  })
})
