import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { TICKER_WATCHLIST } from '../../lib/portfolio-desk/constants'
import { formatAmount, formatPct, formatUsd, truncateWallet } from '../../lib/portfolio-desk/format'

describe('portfolio desk formatters', () => {
  it('formats USD and percents with signs', () => {
    assert.ok(formatUsd(172.01).includes('172'))
    assert.equal(formatPct(3.42), '+3.42%')
    assert.equal(formatPct(-1.2), '-1.20%')
    assert.equal(formatPct(null), '—')
  })

  it('formats large token amounts adaptively', () => {
    assert.ok(formatAmount(32_450_000).endsWith('M'))
    assert.equal(truncateWallet('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'), '7xKX…gAsU')
  })

  it('exposes a fixed ticker watchlist including SOL', () => {
    assert.ok(TICKER_WATCHLIST.some((t) => t.symbol === 'SOL'))
    assert.ok(TICKER_WATCHLIST.length >= 6)
  })
})
