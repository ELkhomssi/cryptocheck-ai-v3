/**
 * Decision Engine — degraded Layer 1 input still emits Decision with degraded=true.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decide } from '../../features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { toCanonicalDecision } from '../../features/terminal-os/ai-trade-like-me/lib/to-canonical-decision'
import type { MarketContext } from '../../features/terminal-os/ai-trade-like-me/types'

function sampleIntel(): MarketContext {
  return {
    tokenSymbol: 'WIF',
    tokenAddress: 'wifmint111111111111111111111111111111111',
    chain: 'solana',
    whaleBias: 'accumulating',
    liquidityTrend: 'increasing',
    smartMoneyScore: 72,
    walletQuality: 60,
    tokenScore: 70,
    securityBand: 'good',
    riskScore: 35,
    newsSentiment: 55,
    marketSentiment: 60,
    orderFlowBias: 'buy',
    volumeScore: 68,
    volatilityPct: 12,
    volumeToLiquidityRatio: 1.4,
    whaleActivityScore: 65,
    predictionUpsidePct: 8,
    conditionVector: {
      whaleActivityScore: 65,
      volumeToLiquidityRatio: 60,
      tokenScore: 70,
      riskScore: 35,
      liquidityRising: 80,
      socialMomentum: 50,
      volatility24h: 40,
    },
    sources: ['test'],
    fetchedAt: new Date().toISOString(),
  }
}

describe('Decision Engine degraded inputs', () => {
  it('emits Decision with degraded=true when security-scanner unavailable', () => {
    const intel = sampleIntel()
    const full = decide(null, intel, { unavailableEngines: [] })
    const degradedExplainable = decide(null, intel, {
      unavailableEngines: ['security-scanner'],
    })
    const canonical = toCanonicalDecision(degradedExplainable, {
      degradedInputs: ['security-scanner'],
      tokenAddress: intel.tokenAddress,
    })

    assert.equal(canonical.degraded, true)
    assert.deepEqual(canonical.degradedInputs, ['security-scanner'])
    assert.ok(
      canonical.confidence < full.scores.confidence,
      `expected confidence ${canonical.confidence} < full ${full.scores.confidence}`,
    )
    assert.ok(
      canonical.reasoning.includes('Degraded') ||
        degradedExplainable.reasons.some((r) => r.includes('Degraded')),
    )
    assert.ok(['BUY', 'SELL', 'WAIT', 'EXIT', 'DO_NOTHING'].includes(canonical.action))
    assert.ok(canonical.staleAfter > canonical.computedAt)
  })

  it('still emits when multiple Layer 1 engines are unavailable', () => {
    const intel = sampleIntel()
    const missing = [
      'security-scanner',
      'whale-intelligence',
      'trader-dna',
      'portfolio-intelligence',
    ] as const
    const explained = decide(null, intel, { unavailableEngines: [...missing] })
    const canonical = toCanonicalDecision(explained, { degradedInputs: [...missing] })
    assert.equal(canonical.degraded, true)
    assert.equal(canonical.degradedInputs?.length, 4)
    assert.ok(canonical.confidence <= 60)
  })
})
