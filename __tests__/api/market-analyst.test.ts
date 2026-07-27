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

describe('Phase 17.2 — Chief Market Strategist voice', () => {
  it('opens in natural strategist voice — not generic section titles', () => {
    const rows = [
      row({ mint: '11111111111111111111111111111111', change24hPct: 5 }),
      row({ mint: '22222222222222222222222222222222', change24hPct: 4 }),
      row({ mint: '33333333333333333333333333333333', change24hPct: 3 }),
      row({ mint: '44444444444444444444444444444444', change24hPct: 6 }),
    ]
    const brief = buildMarketAnalystBrief({ screenerRows: rows, quotes: null })
    assert.match(brief.openingLine, /finished analyzing|I've finished/i)
    assert.doesNotMatch(brief.openingLine, /Executive Conclusion|Market Reconstruction/i)
    assert.doesNotMatch(brief.executiveConclusion, /Executive Conclusion|^Decision\b/i)
  })

  it('attaches confidence from engine scores — never missing', () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      row({
        mint: `${'1'.repeat(31)}${i}`,
        change24hPct: 4,
        smartMoneyScore: 70,
        aiScore: 65,
        riskScore: 30,
        buySellRatio: 1.2,
      }),
    )
    const brief = buildMarketAnalystBrief({ screenerRows: rows, quotes: null })
    assert.ok(brief.decisions.length >= 1)
    for (const d of brief.decisions) {
      assert.ok(d.confidencePct >= 10 && d.confidencePct <= 97)
      assert.ok(Number.isInteger(d.confidencePct))
    }
  })

  it('sets market temperature from breadth/flow — not Fear & Greed label', () => {
    const aggressive = Array.from({ length: 8 }, (_, i) =>
      row({
        mint: `${'2'.repeat(31)}${i}`,
        change24hPct: 5,
        buySellRatio: 1.3,
        smartMoneyScore: 60,
      }),
    )
    const brief = buildMarketAnalystBrief({ screenerRows: aggressive, quotes: null })
    assert.equal(brief.temperature, 'Aggressive')
    assert.match(brief.temperatureLine, /Aggressive/)

    const quietRows = Array.from({ length: 5 }, (_, i) =>
      row({
        mint: `${'3'.repeat(31)}${i}`,
        change24hPct: 0.3,
        buySellRatio: 1.0,
      }),
    )
    const quiet = buildMarketAnalystBrief({ screenerRows: quietRows, quotes: null })
    assert.ok(['Healthy', 'Uncertain'].includes(quiet.temperature))
  })

  it('ends with conviction or honest low-conviction refusal', () => {
    const quietRows = Array.from({ length: 5 }, (_, i) =>
      row({
        mint: `${'4'.repeat(31)}${i}`,
        change24hPct: 0.2,
        buySellRatio: 1.0,
        smartMoneyScore: 20,
        aiScore: 20,
      }),
    )
    const quiet = buildMarketAnalystBrief({ screenerRows: quietRows, quotes: null })
    assert.match(quiet.convictionLine, /don’t currently have a high-conviction/i)

    const strong = Array.from({ length: 10 }, (_, i) =>
      row({
        mint: `${'5'.repeat(31)}${i}`,
        change24hPct: 6,
        buySellRatio: 1.35,
        smartMoneyScore: 80,
        aiScore: 75,
        riskScore: 25,
        symbol: i === 0 ? 'AGENT' : `T${i}`,
      }),
    )
    const brief = buildMarketAnalystBrief({ screenerRows: strong, quotes: null })
    assert.ok(brief.convictionLine.length > 10)
    if (brief.decisions.some((d) => d.confidencePct >= 70)) {
      assert.match(brief.convictionLine, /If I had to focus|don’t currently have a high-conviction/i)
    }
  })

  it('empty sample stays honest', () => {
    const brief = buildMarketAnalystBrief({ screenerRows: [], quotes: null })
    assert.match(brief.executiveConclusion, /Not enough real market data/i)
    assert.equal(isMarketAnalystUnavailable(brief), true)
  })

  it('caps at three elevations', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row({
        mint: `${'6'.repeat(31)}${i}`,
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
})
