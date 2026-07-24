import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BIRDEYE_KEY_MISSING,
  buildOkMarketFeed,
  buildUnavailableMarketFeed,
  filterGraduatedRows,
  filterHighLiquidityPools,
  GRADUATED_LIQUIDITY_FALLBACK_USD,
  hasBirdeyeApiKey,
  mergeNewPoolsByMint,
  newPoolToScreenerRow,
} from '../../lib/terminal/market-feed-helpers'
import type { NewPool, ScreenerRow } from '../../lib/providers/types'

describe('market feed unavailable / empty helpers', () => {
  it('buildUnavailableMarketFeed returns honest empty payload', () => {
    const fixed = '2026-07-24T12:00:00.000Z'
    const body = buildUnavailableMarketFeed(fixed)
    assert.deepEqual(body.items, [])
    assert.equal(body.fetchedAt, fixed)
    assert.equal(body.source, 'unavailable')
    assert.equal(body.error, BIRDEYE_KEY_MISSING)
  })

  it('hasBirdeyeApiKey is false when env key missing or blank', () => {
    assert.equal(hasBirdeyeApiKey({}), false)
    assert.equal(hasBirdeyeApiKey({ BIRDEYE_API_KEY: '' }), false)
    assert.equal(hasBirdeyeApiKey({ BIRDEYE_API_KEY: '   ' }), false)
    assert.equal(hasBirdeyeApiKey({ BIRDEYE_API_KEY: 'sk-test' }), true)
  })

  it('buildOkMarketFeed never invents rows', () => {
    const body = buildOkMarketFeed([], 'birdeye', '2026-07-24T12:00:00.000Z')
    assert.deepEqual(body.items, [])
    assert.equal(body.source, 'birdeye')
    assert.equal(body.error, undefined)
  })
})

describe('market feed merge / graduated helpers', () => {
  it('mergeNewPoolsByMint dedupes by mint and prefers richer fields', () => {
    const a: NewPool[] = [
      {
        mint: 'MintA111111111111111111111111111111111111111',
        symbol: 'AAA',
        name: '',
        poolAddress: 'pool1',
        liquidityUsd: 10_000,
        createdAt: 100,
        source: 'birdeye',
      },
    ]
    const b: NewPool[] = [
      {
        mint: 'MintA111111111111111111111111111111111111111',
        symbol: '',
        name: 'Alpha',
        poolAddress: '',
        liquidityUsd: 25_000,
        createdAt: 90,
        source: 'raydium',
      },
      {
        mint: 'MintB222222222222222222222222222222222222222',
        symbol: 'BBB',
        name: 'Beta',
        poolAddress: 'pool2',
        liquidityUsd: 5_000,
        createdAt: 200,
        source: 'raydium',
      },
    ]
    const merged = mergeNewPoolsByMint(a, b)
    assert.equal(merged.length, 2)
    const alpha = merged.find((p) => p.mint.startsWith('MintA'))!
    assert.equal(alpha.symbol, 'AAA')
    assert.equal(alpha.name, 'Alpha')
    assert.equal(alpha.liquidityUsd, 25_000)
    assert.equal(alpha.createdAt, 90)
    assert.ok(alpha.source.includes('birdeye'))
  })

  it('filterGraduatedRows keeps only isGraduated true', () => {
    const rows = [
      { mint: 'a', isGraduated: true },
      { mint: 'b', isGraduated: false },
    ] as ScreenerRow[]
    assert.deepEqual(
      filterGraduatedRows(rows).map((r) => r.mint),
      ['a'],
    )
  })

  it('liquidity fallback threshold is documented and applied', () => {
    assert.equal(GRADUATED_LIQUIDITY_FALLBACK_USD, 50_000)
    const pools: NewPool[] = [
      {
        mint: 'hi',
        symbol: 'HI',
        name: 'Hi',
        poolAddress: 'p',
        liquidityUsd: 50_001,
        createdAt: 1,
        source: 'birdeye',
      },
      {
        mint: 'lo',
        symbol: 'LO',
        name: 'Lo',
        poolAddress: 'p2',
        liquidityUsd: 49_999,
        createdAt: 2,
        source: 'birdeye',
      },
    ]
    assert.deepEqual(
      filterHighLiquidityPools(pools).map((p) => p.mint),
      ['hi'],
    )
  })

  it('newPoolToScreenerRow does not fabricate prices or smart money', () => {
    const row = newPoolToScreenerRow({
      mint: 'MintC333333333333333333333333333333333333333',
      symbol: 'CCC',
      name: 'Charlie',
      poolAddress: 'pool',
      liquidityUsd: 12_000,
      createdAt: 1,
      source: 'raydium',
    })
    assert.equal(row.priceUsd, 0)
    assert.equal(row.volume24hUsd, 0)
    assert.equal(row.smartMoneyScore, 0)
    assert.equal(row.liquidityUsd, 12_000)
    assert.equal(row.isRaydium, true)
  })
})
