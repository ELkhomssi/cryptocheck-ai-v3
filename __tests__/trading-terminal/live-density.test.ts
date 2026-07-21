import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { RevenuePortfolioSummary } from '../../lib/revenue-dashboard/portfolio-mapper'
import { buildLivePortfolioBrain } from '../../lib/trading-terminal/live-portfolio-brain'
import { applyDexQuotes } from '../../lib/trading-terminal/discover-enrich'
import type { DiscoverToken } from '../../lib/trading-terminal/data/types'

function summary(partial: Partial<RevenuePortfolioSummary> & { positions: RevenuePortfolioSummary['positions'] }): RevenuePortfolioSummary {
  const total = partial.totalValueUsd ?? partial.positions.reduce((a, p) => a + p.valueUsd, 0)
  return {
    walletAddress: 'Wallet1111111111111111111111111111111111111',
    totalValueUsd: total,
    holdingCount: partial.positions.length,
    flaggedCount: partial.flaggedCount ?? 0,
    flaggedValueUsd: partial.flaggedValueUsd ?? 0,
    flaggedPct: partial.flaggedPct ?? 0,
    exposure: partial.exposure ?? 'LOW',
    positions: partial.positions,
    lastUpdatedAt: new Date().toISOString(),
    totalPnlUsd: partial.totalPnlUsd,
    totalPnlPct: partial.totalPnlPct,
  }
}

describe('buildLivePortfolioBrain', () => {
  it('scores SAFE book high and queues nothing urgent', () => {
    const brain = buildLivePortfolioBrain(
      summary({
        exposure: 'LOW',
        positions: [
          {
            mint: 'MintSafe111111111111111111111111111111111',
            symbol: 'SAFE1',
            name: 'SAFE1',
            balance: 100,
            valueUsd: 800,
            safetyScore: 90,
            riskScore: 12,
            verdict: 'SAFE',
            concentrationPct: 80,
            scannedAt: '',
            estimated: false,
          },
          {
            mint: 'MintSafe222222222222222222222222222222222',
            symbol: 'SAFE2',
            name: 'SAFE2',
            balance: 50,
            valueUsd: 200,
            safetyScore: 85,
            riskScore: 18,
            verdict: 'SAFE',
            concentrationPct: 20,
            scannedAt: '',
            estimated: false,
          },
        ],
      }),
    )
    assert.ok(brain.health.score >= 70)
    assert.equal(brain.threats.length, 0)
    assert.ok(brain.actionQueue.every((a) => a.type !== 'EXIT'))
    assert.ok(brain.portions.legend.length >= 1)
  })

  it('flags DANGER holdings into threats + EXIT queue', () => {
    const brain = buildLivePortfolioBrain(
      summary({
        exposure: 'HIGH',
        flaggedCount: 1,
        flaggedPct: 55,
        flaggedValueUsd: 550,
        positions: [
          {
            mint: 'MintDanger1111111111111111111111111111111',
            symbol: 'RUG',
            name: 'RUG',
            balance: 1e6,
            valueUsd: 550,
            safetyScore: 20,
            riskScore: 82,
            verdict: 'DANGER',
            concentrationPct: 55,
            scannedAt: '',
            estimated: false,
          },
          {
            mint: 'MintOk11111111111111111111111111111111111',
            symbol: 'OK',
            name: 'OK',
            balance: 10,
            valueUsd: 450,
            safetyScore: 70,
            riskScore: 25,
            verdict: 'SAFE',
            concentrationPct: 45,
            scannedAt: '',
            estimated: false,
          },
        ],
      }),
    )
    assert.ok(brain.health.score < 55)
    assert.equal(brain.threats[0]?.symbol, 'RUG')
    assert.ok(brain.actionQueue.some((a) => a.type === 'EXIT' && a.symbol === 'RUG'))
    assert.ok(brain.riskExposure.categories.some((c) => c.name === 'DANGER' && c.pct > 0))
  })
})

describe('applyDexQuotes', () => {
  it('merges quote fields without inventing missing mints', () => {
    const rows: DiscoverToken[] = [
      {
        mint: 'A'.repeat(44),
        symbol: 'AAA',
        name: 'AAA',
        priceUsd: 0,
        changePct: 0,
        marketCapUsd: 0,
        views: 1,
        badge: null,
      },
    ]
    const quotes = new Map([
      [
        rows[0]!.mint,
        { priceUsd: 1.25, changePct: 4.2, marketCapUsd: 2_000_000, at: Date.now() },
      ],
    ])
    const out = applyDexQuotes(rows, quotes)
    assert.equal(out[0]!.priceUsd, 1.25)
    assert.equal(out[0]!.changePct, 4.2)
    assert.equal(out[0]!.marketCapUsd, 2_000_000)
  })
})
