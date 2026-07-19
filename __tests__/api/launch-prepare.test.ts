import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import BN from 'bn.js'
import { resolveCurveParams } from '../../lib/launch/curve-params'
import { screenLaunchMetadata } from '../../lib/launch/screen-metadata'
import { MIN_SOL_TARGET, MIN_SUPPLY_HUMAN } from '../../lib/launch/constants'

describe('launch metadata screening', () => {
  it('rejects impersonation tickers and scam phrases', () => {
    const reasons = screenLaunchMetadata({
      name: 'Official SOL Airdrop',
      ticker: 'SOL',
      description: '100x guaranteed risk-free',
      imageUrl: 'https://example.com/logo.png',
    })
    assert.ok(reasons.some((r) => /impersonat|SOL/i.test(r)))
    assert.ok(reasons.some((r) => /scam phrasing/i.test(r)))
  })

  it('passes clean metadata', () => {
    const reasons = screenLaunchMetadata({
      name: 'Orbital Finch',
      ticker: 'OFIN',
      description: 'Community experiment',
      imageUrl: 'https://example.com/finch.png',
    })
    assert.deepEqual(reasons, [])
  })
})

describe('launch curve params', () => {
  it('rejects solTarget below floor and low supply', () => {
    const bad = resolveCurveParams({
      curveType: 'custom',
      supply: 1000,
      solTarget: 5,
    })
    assert.equal(bad.ok, false)
    if (!bad.ok) {
      assert.ok(bad.reasons.some((r) => r.includes(String(MIN_SOL_TARGET))))
      assert.ok(bad.reasons.some((r) => r.includes(MIN_SUPPLY_HUMAN.toLocaleString())))
    }
  })

  it('accepts JustSendIt with solTarget >= 30', () => {
    const ok = resolveCurveParams({
      curveType: 'justsendit',
      supply: MIN_SUPPLY_HUMAN,
      solTarget: 30,
    })
    assert.equal(ok.ok, true)
    if (ok.ok) {
      assert.ok(ok.params.totalFundRaisingB.gte(new BN(30e9)))
    }
  })
})
