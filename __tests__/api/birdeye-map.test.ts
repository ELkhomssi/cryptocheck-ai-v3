/**
 * Unit tests for Birdeye response mappers (no network).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  extractBirdeyeTokenRows,
  mapBirdeyeRowToMetrics,
  mapBirdeyeRowToScreener,
  SCREENER_SORT_TO_BIRDEYE_V3,
} from '../../lib/providers/birdeye-map'

describe('birdeye-map', () => {
  it('maps V3 snake_case fields', () => {
    const m = mapBirdeyeRowToMetrics('Mint111', {
      symbols: 'ABC',
      name: 'Abc Token',
      price: 1.5,
      price_change_24h_percent: 12.3,
      price_change_1h_percent: -1.1,
      price_change_5m_percent: 0.4,
      volume_24h_usd: 9_000_000,
      liquidity: 500_000,
      market_cap: 2_000_000,
      fdv: 3_000_000,
      holder: 4200,
      trade_24h_count: 88,
      logo_uri: 'https://example.com/a.png',
    })
    assert.equal(m.symbol, 'ABC')
    assert.equal(m.change24hPct, 12.3)
    assert.equal(m.change1hPct, -1.1)
    assert.equal(m.volume24hUsd, 9_000_000)
    assert.equal(m.marketCapUsd, 2_000_000)
    assert.equal(m.holders, 4200)
    assert.equal(m.logoUrl, 'https://example.com/a.png')
  })

  it('maps trending aliases (price24hChangePercent / marketcap)', () => {
    const m = mapBirdeyeRowToMetrics('Mint222', {
      symbol: 'XYZ',
      price24hChangePercent: 5,
      marketcap: 1000,
      volume24hUSD: 50,
    })
    assert.equal(m.change24hPct, 5)
    assert.equal(m.marketCapUsd, 1000)
    assert.equal(m.volume24hUsd, 50)
  })

  it('extracts tokens / items envelopes', () => {
    assert.equal(
      extractBirdeyeTokenRows({ data: { tokens: [{ address: 'A' }] } }).length,
      1,
    )
    assert.equal(
      extractBirdeyeTokenRows({ data: { items: [{ address: 'B' }] } }).length,
      1,
    )
    assert.equal(extractBirdeyeTokenRows({ data: [{ address: 'C' }] }).length, 1)
    assert.equal(extractBirdeyeTokenRows(null).length, 0)
  })

  it('mapBirdeyeRowToScreener requires mint', () => {
    assert.equal(mapBirdeyeRowToScreener({ symbol: 'NO' }), null)
    const row = mapBirdeyeRowToScreener({ address: 'Mint333', symbol: 'OK' }, { isTrending: true })
    assert.ok(row)
    assert.equal(row!.mint, 'Mint333')
    assert.equal(row!.isTrending, true)
  })

  it('maps screener sort keys to V3', () => {
    assert.equal(SCREENER_SORT_TO_BIRDEYE_V3.volume, 'volume_24h_usd')
    assert.equal(SCREENER_SORT_TO_BIRDEYE_V3.v24hChangePercent, 'price_change_24h_percent')
  })
})
