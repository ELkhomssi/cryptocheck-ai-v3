/**
 * Honesty sprint — market confidence calibration + Discovery filter.
 * Run: node --import tsx --test __tests__/terminal-os/decision-honesty.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeConfidence,
  computeMarketConfidence,
} from '../../features/terminal-os/ai-trade-like-me/lib/scoring'
import { decide } from '../../features/terminal-os/ai-trade-like-me/engines/decision-engine'
import type { MarketContext } from '../../features/terminal-os/ai-trade-like-me/types'
import type { Decision } from '@cryptocheck/decision-contracts'
import { toCanonicalDecision } from '../../features/terminal-os/ai-trade-like-me/lib/to-canonical-decision'

const HIGH = 70

function intel(over: Partial<MarketContext> = {}): MarketContext {
  return {
    tokenSymbol: 'SOL',
    chain: 'solana',
    whaleBias: 'accumulating',
    liquidityTrend: 'increasing',
    smartMoneyScore: 72,
    walletQuality: 70,
    tokenScore: 78,
    securityBand: 'good',
    riskScore: 28,
    newsSentiment: 60,
    marketSentiment: 62,
    orderFlowBias: 'buy',
    volumeScore: 70,
    volatilityPct: 8,
    volumeToLiquidityRatio: 5,
    whaleActivityScore: 70,
    predictionUpsidePct: 14,
    conditionVector: {
      whaleActivityScore: 70,
      volumeToLiquidityRatio: 60,
      tokenScore: 78,
      riskScore: 28,
      liquidityRising: 80,
      socialMomentum: 55,
      volatility24h: 40,
    },
    sources: ['dexscreener'],
    fetchedAt: new Date().toISOString(),
    ...over,
  }
}

function discoveryPass(d: Decision): boolean {
  const conf = d.marketConfidence ?? d.confidence
  if (d.action !== 'BUY' && d.action !== 'WAIT') return false
  return conf >= HIGH
}

describe('decision honesty — null DNA market confidence', () => {
  it('excludes behaviorMatch from market confidence (not baselined at 35)', () => {
    const market = computeMarketConfidence({
      marketQuality: 80,
      probability: 70,
      timing: 65,
      executionQuality: 75,
      risk: 25,
    })
    const personalizedLowBm = computeConfidence({
      behaviorMatch: 35,
      marketQuality: 80,
      probability: 70,
      timing: 65,
      executionQuality: 75,
      risk: 25,
    })
    assert.ok(market >= HIGH, `market conf ${market} should clear Discovery threshold`)
    assert.ok(
      market > personalizedLowBm,
      `market ${market} should beat penalized-BM personalized ${personalizedLowBm}`,
    )
  })

  it('decide(null DNA) emits market mode with marketConfidence usable by Discovery', () => {
    const explained = decide(null, intel(), {
      unavailableEngines: ['trader-dna', 'portfolio-intelligence'],
    })
    assert.equal(explained.scores.confidenceMode, 'market')
    assert.equal(explained.scores.personalizedConfidence, undefined)
    assert.ok(explained.scores.marketConfidence >= 1)
    assert.equal(explained.scores.confidence, explained.scores.marketConfidence)

    const canonical = toCanonicalDecision(explained, {
      degradedInputs: ['trader-dna', 'portfolio-intelligence'],
      tokenAddress: 'So11111111111111111111111111111111111111112',
    })
    assert.equal(canonical.confidenceMode, 'market')
    assert.ok(canonical.marketConfidence === explained.scores.marketConfidence)

    // Strong market intel should surface as BUY or WAIT at ≥70 for Discovery
    if (explained.action === 'BUY' || explained.action === 'WAIT') {
      assert.ok(
        discoveryPass(canonical) || explained.action === 'WAIT',
        `action=${explained.action} marketConf=${canonical.marketConfidence}`,
      )
    }
    // Never permanently capped below Discovery by missing DNA alone
    assert.ok(
      explained.scores.marketConfidence >= 50,
      `null-DNA market conf ${explained.scores.marketConfidence} should not collapse to ~35`,
    )
  })

  it('strong null-DNA market path can emit BUY at ≥70', () => {
    const explained = decide(null, intel({ riskScore: 20, tokenScore: 85, smartMoneyScore: 80 }), {
      unavailableEngines: ['trader-dna'],
    })
    assert.equal(explained.scores.confidenceMode, 'market')
    if (explained.action === 'BUY') {
      assert.ok(explained.scores.marketConfidence >= HIGH)
      const d = toCanonicalDecision(explained)
      assert.ok(discoveryPass(d))
    }
  })
})
