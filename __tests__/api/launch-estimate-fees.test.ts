import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CREATION_PLATFORM_FEE_LAMPORTS,
  ESTIMATED_NETWORK_FEE_LAMPORTS,
  FEE_RATE_DENOMINATOR,
} from '../../lib/launch/estimate-fees'
import { CREATOR_FEE_RATE, PLATFORM_FEE_RATE } from '../../lib/launch/config'
import { classifyLaunchError, newTrackingId } from '../../lib/launch/errors'
import { getLiquidityProvider, listLiquidityProviders } from '../../lib/launch/liquidity'

describe('launch fee constants', () => {
  it('discloses zero create skim and non-zero curve rates', () => {
    assert.equal(CREATION_PLATFORM_FEE_LAMPORTS, 0)
    assert.ok(ESTIMATED_NETWORK_FEE_LAMPORTS > 0)
    assert.equal(PLATFORM_FEE_RATE.toNumber(), 10_000)
    assert.equal(CREATOR_FEE_RATE.toNumber(), 5_000)
    assert.equal(FEE_RATE_DENOMINATOR, 1_000_000)
    const platformBps = Math.round((PLATFORM_FEE_RATE.toNumber() / FEE_RATE_DENOMINATOR) * 10_000)
    const creatorBps = Math.round((CREATOR_FEE_RATE.toNumber() / FEE_RATE_DENOMINATOR) * 10_000)
    assert.equal(platformBps, 100)
    assert.equal(creatorBps, 50)
  })
})

describe('launch errors', () => {
  it('classifies wallet rejection and blockhash expiry', () => {
    assert.equal(classifyLaunchError(new Error('User rejected the request')), 'USER_REJECTED')
    assert.equal(classifyLaunchError(new Error('Blockhash expired')), 'BLOCKHASH_EXPIRED')
    assert.ok(newTrackingId().startsWith('launch_'))
  })
})

describe('liquidity providers', () => {
  it('exposes Raydium CPMM as available and reserves others', () => {
    const all = listLiquidityProviders()
    assert.ok(all.length >= 4)
    assert.equal(getLiquidityProvider('raydium-cpmm').isAvailable(), true)
    assert.equal(getLiquidityProvider('meteora').isAvailable(), false)
  })
})
