import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildMarketAnalystBrief,
  isMarketAnalystUnavailable,
  type MarketMacroQuotes,
} from '../../lib/portfolio-desk/market-analyst'
import type { ScreenerRow } from '../../lib/providers/types'

function row(partial: Partial<ScreenerRow> & { mint: string }): ScreenerRow {
  return {
    mint: partial.mint,
    symbol: partial.symbol ?? 'TOK',
    name: partial.name ?? 'Token',
    priceUsd: partial.priceUsd ?? 1,
    change5mPct: partial.change5mPct ?? 0,
    change1hPct: partial.change1hPct ?? 0,
    change24hPct: partial.change24hPct ?? 0,
    volume24hUsd: partial.volume24hUsd ?? 100_000,
    liquidityUsd: partial.liquidityUsd ?? 200_000,
    marketCapUsd: partial.marketCapUsd ?? 1_000_000,
    fdvUsd: partial.fdvUsd ?? 1_000_000,
    holders: partial.holders ?? 100,
    txCount24h: partial.txCount24h ?? 50,
    buySellRatio: partial.buySellRatio ?? 1,
    riskScore: partial.riskScore ?? 40,
    aiScore: partial.aiScore ?? 50,
    isPumpFun: partial.isPumpFun ?? false,
    isRaydium: partial.isRaydium ?? false,
    isGraduated: partial.isGraduated ?? false,
    isVerified: partial.isVerified ?? false,
    isTrending: partial.isTrending ?? false,
    smartMoneyScore: partial.smartMoneyScore ?? 40,
  }
}

describe('Phase 17.2 — Market Analyst briefing', () => {
  it('says not enough data when sample is empty', () => {
    const brief = buildMarketAnalystBrief({ screenerRows: [], quotes: null })
    assert.match(brief.executiveConclusion, /Not enough real market data/i)
    assert.equal(isMarketAnalystUnavailable(brief), true)
    assert.equal(brief.decisions.length, 0)
  })

  it('executive conclusion is human speech — not a metric headline', () => {
    const rows = [
      row({ mint: '11111111111111111111111111111111', change24hPct: 5, symbol: 'A' }),
      row({ mint: '22222222222222222222222222222222', change24hPct: 4, symbol: 'B' }),
      row({ mint: '33333333333333333333333333333333', change24hPct: 3, symbol: 'C' }),
      row({ mint: '44444444444444444444444444444444', change24hPct: 6, symbol: 'D' }),
    ]
    const brief = buildMarketAnalystBrief({ screenerRows: rows, quotes: null })
    assert.match(brief.executiveConclusion, /strengthening/i)
    assert.doesNotMatch(brief.executiveConclusion, /^\+?\d+(\.\d+)?%$/)
    assert.ok(brief.decisions.length >= 1 && brief.decisions.length <= 3)
  })

  it('each decision answers What / Why / Do — evidence only attached', () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      row({
        mint: `${'1'.repeat(31)}${i}`,
        buySellRatio: 1.3,
        smartMoneyScore: 30,
        change24hPct: 3 + i,
        volume24hUsd: 500_000,
      }),
    )
    const brief = buildMarketAnalystBrief({ screenerRows: rows, quotes: null })
    assert.ok(brief.decisions.length >= 1)
    for (const d of brief.decisions) {
      assert.ok(d.whatHappened.length > 10)
      assert.ok(d.whyItMatters.length > 10)
      assert.ok(d.whatToDo.length > 10)
      assert.ok(d.evidence)
      assert.doesNotMatch(d.whatHappened, /^Volume \+/)
    }
  })

  it('caps at three decisions', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row({
        mint: `${'2'.repeat(31)}${i}`,
        change24hPct: 5,
        buySellRatio: 1.4,
        smartMoneyScore: 70,
      }),
    )
    const quotes: MarketMacroQuotes = {
      solUsd: 140,
      solChangePct: -1,
      btcUsd: 60_000,
      btcChangePct: 3,
      ethUsd: 3000,
      ethChangePct: 2,
      fearGreed: 72,
      fearGreedLabel: 'Greed',
      marketCapUsd: 2e12,
      marketCapChangePct: 2,
      tps: 2000,
      activeWallets: null,
    }
    const brief = buildMarketAnalystBrief({ screenerRows: rows, quotes })
    assert.ok(brief.decisions.length <= 3)
  })

  it('quiet tape says so — does not invent urgency', () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      row({
        mint: `${'3'.repeat(31)}${i}`,
        change24hPct: 0.4,
        buySellRatio: 1.0,
        smartMoneyScore: 40,
      }),
    )
    const brief = buildMarketAnalystBrief({ screenerRows: rows, quotes: null })
    assert.equal(brief.quiet, true)
    assert.match(brief.executiveConclusion, /quiet/i)
    assert.ok(brief.decisions.every((d) => /quiet|significant|monitoring/i.test(d.whatHappened + d.whatToDo)))
  })

  it('reconstruction steps exist before any decision', () => {
    const brief = buildMarketAnalystBrief({
      screenerRows: [row({ mint: '11111111111111111111111111111111', change24hPct: 4 })],
      quotes: null,
    })
    assert.ok(brief.reconstruction.length >= 3)
    assert.ok(brief.reconstruction.every((s) => s.label && s.status))
  })
})
