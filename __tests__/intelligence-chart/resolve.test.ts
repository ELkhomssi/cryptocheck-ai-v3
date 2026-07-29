import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { selectBestTokenMatch } from '../../lib/terminal-os/select-best-token-match'
import type { TokenRow } from '../../features/terminal-os/shared/types'

function tok(p: Partial<TokenRow> & Pick<TokenRow, 'id' | 'symbol'>): TokenRow {
  return {
    name: p.name ?? p.symbol,
    chain: p.chain ?? 'solana',
    priceUsd: p.priceUsd ?? 1,
    change24hPct: p.change24hPct ?? 0,
    volume24hUsd: p.volume24hUsd ?? 1_000_000,
    liquidityUsd: p.liquidityUsd ?? 100_000,
    marketCapUsd: p.marketCapUsd ?? 1_000_000,
    txCount24h: p.txCount24h ?? 100,
    buySellRatio: p.buySellRatio ?? 1,
    sparkline: p.sparkline ?? [1, 1],
    ...p,
  }
}

describe('selectBestTokenMatch (intelligence chart resolve)', () => {
  it('matches $WIF when querying WIF and rejects fake depth', () => {
    const junk = tok({
      id: 'junk',
      symbol: 'WIF',
      liquidityUsd: 1e9,
      volume24hUsd: 4,
      priceUsd: 1.5,
    })
    const real = tok({
      id: 'real',
      symbol: '$WIF',
      liquidityUsd: 4e6,
      volume24hUsd: 80_000,
      priceUsd: 0.15,
    })
    assert.equal(selectBestTokenMatch('WIF', [junk, real])?.id, 'real')
  })
})
