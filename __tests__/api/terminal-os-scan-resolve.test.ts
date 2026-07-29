import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isSuspiciousMarketRow,
  normalizeTokenSymbol,
  selectBestTokenMatch,
} from '../../lib/terminal-os/select-best-token-match'
import type { TokenRow } from '../../features/terminal-os/shared/types'

function tok(partial: Partial<TokenRow> & Pick<TokenRow, 'id' | 'symbol'>): TokenRow {
  return {
    name: partial.name ?? partial.symbol,
    chain: partial.chain ?? 'solana',
    priceUsd: partial.priceUsd ?? 1,
    change24hPct: partial.change24hPct ?? 0,
    volume24hUsd: partial.volume24hUsd ?? 1_000_000,
    liquidityUsd: partial.liquidityUsd ?? 100_000,
    marketCapUsd: partial.marketCapUsd ?? 1_000_000,
    txCount24h: partial.txCount24h ?? 100,
    buySellRatio: partial.buySellRatio ?? 1,
    sparkline: partial.sparkline ?? [1, 1, 1],
    ...partial,
  }
}

describe('selectBestTokenMatch (scan resolve)', () => {
  it('prefers exact symbol over higher-liquidity unrelated token', () => {
    const pepe = tok({
      id: 'pepe',
      symbol: 'PEPE',
      liquidityUsd: 50_000_000,
      volume24hUsd: 20_000_000,
      chain: 'ethereum',
    })
    const wif = tok({
      id: 'wif-mint',
      symbol: 'WIF',
      name: 'dogwifhat',
      liquidityUsd: 2_000_000,
      volume24hUsd: 5_000_000,
      chain: 'solana',
    })
    const hit = selectBestTokenMatch('WIF', [pepe, wif])
    assert.equal(hit?.symbol, 'WIF')
    assert.equal(hit?.id, 'wif-mint')
  })

  it('matches $WIF when user types WIF', () => {
    assert.equal(normalizeTokenSymbol('$WIF'), 'wif')
    const junk = tok({
      id: 'junk',
      symbol: 'WIF',
      liquidityUsd: 1_500_000_000,
      volume24hUsd: 4,
      priceUsd: 1.5,
    })
    const real = tok({
      id: 'real-wif',
      symbol: '$WIF',
      liquidityUsd: 4_000_000,
      volume24hUsd: 80_000,
      priceUsd: 0.15,
    })
    assert.equal(isSuspiciousMarketRow(junk), true)
    assert.equal(selectBestTokenMatch('WIF', [junk, real])?.id, 'real-wif')
  })

  it('among exact symbols prefers volume over fake depth', () => {
    const thinVol = tok({ id: 'a', symbol: 'WIF', liquidityUsd: 10_000_000, volume24hUsd: 200 })
    const thickVol = tok({ id: 'b', symbol: 'WIF', liquidityUsd: 500_000, volume24hUsd: 2_000_000 })
    assert.equal(selectBestTokenMatch('wif', [thinVol, thickVol])?.id, 'b')
  })

  it('matches mint/address exactly', () => {
    const a = tok({ id: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' })
    const b = tok({ id: 'other', symbol: 'USDT' })
    assert.equal(
      selectBestTokenMatch('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', [a, b])?.symbol,
      'USDC',
    )
  })

  it('returns null for empty candidates — never invents a fallback', () => {
    assert.equal(selectBestTokenMatch('WIF', []), null)
  })

  it('name contains only when no exact symbol', () => {
    const pepe = tok({ id: '1', symbol: 'PEPE', name: 'Pepe', liquidityUsd: 9e9, volume24hUsd: 9e9 })
    const dog = tok({ id: '2', symbol: 'DOG', name: 'dogwifhat clone', liquidityUsd: 1e5, volume24hUsd: 5e4 })
    assert.equal(selectBestTokenMatch('dogwifhat', [pepe, dog])?.id, '2')
  })
})
