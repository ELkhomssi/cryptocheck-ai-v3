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

describe('Phase 17.2 — Market Analyst brief', () => {
  it('says not enough data when sample is empty', () => {
    const brief = buildMarketAnalystBrief({ screenerRows: [], quotes: null })
    assert.match(brief.conclusion, /Not enough real market data/i)
    assert.equal(isMarketAnalystUnavailable(brief), true)
    assert.equal(brief.insightCards.length, 0)
  })

  it('leads with a human conclusion — not a raw +42% metric headline', () => {
    const rows = [
      row({ mint: '11111111111111111111111111111111', change24hPct: 5, symbol: 'A' }),
      row({ mint: '22222222222222222222222222222222', change24hPct: 4, symbol: 'B' }),
      row({ mint: '33333333333333333333333333333333', change24hPct: 3, symbol: 'C' }),
      row({ mint: '44444444444444444444444444444444', change24hPct: 6, symbol: 'D' }),
    ]
    const brief = buildMarketAnalystBrief({ screenerRows: rows, quotes: null })
    assert.match(brief.conclusion, /strengthening/i)
    assert.doesNotMatch(brief.conclusion, /^\+?\d+(\.\d+)?%$/)
    assert.doesNotMatch(brief.conclusion, /Volume \+/i)
    assert.ok(brief.insightCards.length >= 1)
    assert.ok(brief.insightCards.every((c) => c.evidence.metrics.length > 0))
  })

  it('turns buy/sell + smart-money into flow insight language', () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      row({
        mint: `${'1'.repeat(31)}${i}`,
        buySellRatio: 1.3,
        smartMoneyScore: 30,
        change24hPct: 2 + i,
        volume24hUsd: 500_000,
      }),
    )
    const brief = buildMarketAnalystBrief({ screenerRows: rows, quotes: null })
    const flow = brief.insightCards.find((c) => c.id === 'flow')
    assert.ok(flow)
    assert.match(flow!.conclusion, /Buying pressure|newer flow|smart-money/i)
    assert.doesNotMatch(flow!.conclusion, /^Volume \+/)
  })

  it('groups narratives from real name/symbol matches only', () => {
    const rows = [
      row({
        mint: 'AiAiAiAiAiAiAiAiAiAiAiAiAiAiAiAi',
        symbol: 'AGENT',
        name: 'AI Agent Compute',
        change24hPct: 8,
        volume24hUsd: 2_000_000,
      }),
      row({
        mint: 'BonkBonkBonkBonkBonkBonkBonkBonk1',
        symbol: 'BONK',
        name: 'Bonk meme',
        isPumpFun: true,
        change24hPct: -4,
      }),
      row({
        mint: 'SwapSwapSwapSwapSwapSwapSwapSwap',
        symbol: 'YLD',
        name: 'Yield Vault Finance',
        isRaydium: true,
        liquidityUsd: 500_000,
        volume24hUsd: 200_000,
        change24hPct: 1,
      }),
    ]
    const brief = buildMarketAnalystBrief({ screenerRows: rows, quotes: null })
    const ai = brief.narratives.find((n) => n.id === 'ai')
    const meme = brief.narratives.find((n) => n.id === 'memecoins')
    const defi = brief.narratives.find((n) => n.id === 'defi')
    assert.ok(ai && ai.tokenCount >= 1)
    assert.ok(meme && meme.tokenCount >= 1)
    assert.ok(defi && defi.tokenCount >= 1)
    assert.match(ai!.liquidityMove, /liquidity|Turnover|volume/i)
    assert.ok(ai!.evidence.movers.length >= 1)
  })

  it('empty narrative clusters stay honest — no fabricated analysis', () => {
    const rows = [
      row({
        mint: 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
        symbol: 'XYZ',
        name: 'Obscure',
        change24hPct: 1,
      }),
    ]
    const brief = buildMarketAnalystBrief({ screenerRows: rows, quotes: null })
    const rwa = brief.narratives.find((n) => n.id === 'rwa')
    assert.ok(rwa)
    assert.equal(rwa!.tokenCount, 0)
    assert.match(rwa!.conclusion, /Not enough real market data/i)
  })

  it('macro insight cards interpret BTC / Fear&Greed without leading numbers', () => {
    const quotes: MarketMacroQuotes = {
      solUsd: 140,
      solChangePct: 1.2,
      btcUsd: 60_000,
      btcChangePct: 3.5,
      ethUsd: 3000,
      ethChangePct: 2,
      fearGreed: 52,
      fearGreedLabel: 'Neutral',
      marketCapUsd: 2e12,
      marketCapChangePct: 0.4,
      tps: 2000,
      activeWallets: null,
      source: 'test',
    }
    const brief = buildMarketAnalystBrief({ screenerRows: [], quotes })
    const btc = brief.insightCards.find((c) => c.id === 'btc')
    const sentiment = brief.insightCards.find((c) => c.id === 'sentiment')
    assert.ok(btc)
    assert.match(btc!.conclusion, /Bitcoin|Solana|liquidity/i)
    assert.doesNotMatch(btc!.conclusion, /^BTC Dominance/i)
    assert.ok(sentiment)
    assert.match(sentiment!.conclusion, /optimism|Fear|Sentiment|cautious/i)
    assert.doesNotMatch(sentiment!.conclusion, /^Fear & Greed$/i)
    // Raw numbers live in evidence, not the conclusion headline
    assert.ok(btc!.evidence.metrics.some((m) => m.label.includes('BTC')))
  })

  it('exposes Data → Thinking steps before Decision fields', () => {
    const rows = [
      row({ mint: '11111111111111111111111111111111', change24hPct: 4, buySellRatio: 1.2 }),
      row({ mint: '22222222222222222222222222222222', change24hPct: 3, buySellRatio: 1.1 }),
      row({ mint: '33333333333333333333333333333333', change24hPct: 2, buySellRatio: 1.15 }),
    ]
    const brief = buildMarketAnalystBrief({ screenerRows: rows, quotes: null })
    assert.ok(brief.dataSteps.length >= 3)
    assert.ok(brief.thinkingSteps.length >= 3)
    assert.ok(brief.dataSteps.every((s) => s.label && s.status))
    assert.ok(brief.thinkingSteps.every((s) => s.done))
    assert.ok(brief.conclusion)
    // Evidence is attached but must not replace the decision headline
    assert.notEqual(brief.conclusion, brief.dataSteps[0]!.status)
  })
})
