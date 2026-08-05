/**
 * Foundation Integrity Gate — Check 3 engine capability evidence.
 * Run: node --import tsx --test __tests__/terminal-os/foundation-check3-evidence.test.ts
 *
 * NOTE: sample DNA proves the *engine* can diverge. Production capture still fails Check 2.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildTraderDna } from '../../features/terminal-os/ai-trade-like-me/engines/trader-dna-engine'
import { decide } from '../../features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { buildSampleTradeHistory } from '../../features/terminal-os/ai-trade-like-me/lib/sample-trade-history'
import { normalizeCapturedTrade } from '../../features/terminal-os/ai-trade-like-me/lib/normalize-trade'
import type { MarketContext } from '../../features/terminal-os/ai-trade-like-me/types'

function baseIntel(over: Partial<MarketContext> = {}): MarketContext {
  return {
    tokenSymbol: 'SOL',
    chain: 'solana',
    whaleBias: 'accumulating',
    liquidityTrend: 'increasing',
    smartMoneyScore: 80,
    walletQuality: 75,
    tokenScore: 82,
    securityBand: 'good',
    riskScore: 32,
    newsSentiment: 60,
    marketSentiment: 62,
    orderFlowBias: 'buy',
    volumeScore: 78,
    volatilityPct: 12,
    volumeToLiquidityRatio: 5,
    whaleActivityScore: 78,
    predictionUpsidePct: 18,
    conditionVector: {
      whaleActivityScore: 78,
      volumeToLiquidityRatio: 50,
      tokenScore: 82,
      riskScore: 68,
      volatility24h: 12,
      socialMomentum: 70,
      newsSentiment: 60,
      liquidityRising: 80,
    },
    sources: ['test'],
    fetchedAt: new Date().toISOString(),
    ...over,
  }
}

describe('FOUNDATION Check 3 evidence', () => {
  it('sample-trained DNA vs null DNA diverge on identical MarketContext', () => {
    const intel = baseIntel()
    const untrained = decide(null, intel)
    const dna = buildTraderDna('WalletTrain', buildSampleTradeHistory('WalletTrain'))
    const trained = decide(dna, intel)

    // Evidence for gate report (stdout)
    console.log(
      JSON.stringify(
        {
          token: intel.tokenSymbol,
          untrained: {
            action: untrained.action,
            behaviorMatch: untrained.opportunity.behaviorMatch,
            confidence: untrained.opportunity.confidence,
            reasons: untrained.reasons.slice(0, 4),
          },
          trained_sample_NOT_production_capture: {
            action: trained.action,
            behaviorMatch: trained.opportunity.behaviorMatch,
            confidence: trained.opportunity.confidence,
            sampleSize: dna.sampleSize,
            avgHoldingMs: dna.avgHoldingMs,
            style: dna.tradingStyleSummary,
            reasons: trained.reasons.slice(0, 5),
          },
        },
        null,
        2,
      ),
    )

    assert.equal(untrained.opportunity.behaviorMatch, 35)
    assert.notEqual(untrained.opportunity.behaviorMatch, trained.opportunity.behaviorMatch)
    assert.ok(
      trained.reasons.some((r) => /TraderDNA|historical|avgHoldingMs|riskAppetite/i.test(r)),
      'trained reasons should cite DNA fields',
    )
  })

  it('production signature-stub DNA cannot learn hold time or PnL', () => {
    const stubs = Array.from({ length: 12 }, (_, i) =>
      normalizeCapturedTrade({
        id: `onchain:sig${i}`,
        wallet: 'StubWal',
        tokenSymbol: 'UNK',
        tokenMint: 'So11111111111111111111111111111111111111112',
        chain: 'solana',
        side: 'buy',
        entryAt: new Date(Date.now() - i * 3_600_000).toISOString(),
        entryPriceUsd: 0,
        positionSizeUsd: 0,
        entryWhy: 'On-chain signature captured for behavioral learning (read-only)',
        sample: false,
      }),
    )
    const dna = buildTraderDna('StubWal', stubs)
    console.log(
      JSON.stringify(
        {
          stubDna: {
            sampleSize: dna.sampleSize,
            avgHoldingMs: dna.avgHoldingMs,
            lossTolerancePct: dna.lossTolerancePct,
            winRatePct: dna.winRatePct,
            style: dna.tradingStyleSummary,
            entryProfileLen: dna.entryConditionProfile?.length ?? 0,
          },
        },
        null,
        2,
      ),
    )
    assert.equal(dna.avgHoldingMs, 0)
    assert.equal(dna.lossTolerancePct, 8)
    assert.equal(dna.winRatePct, 0)
  })
})
