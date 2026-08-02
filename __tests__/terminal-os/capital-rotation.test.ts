/**
 * Capital rotation — deterioration + aggregate honesty.
 * Run: node --import tsx --test __tests__/terminal-os/capital-rotation.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assessDeterioration,
  computeRotationAggregate,
} from '../../features/terminal-os/capital-rotation/logic'
import type { MarketContext } from '../../features/terminal-os/ai-trade-like-me/types'
import type { RotationEvent } from '../../features/terminal-os/capital-rotation/types'

function intel(over: Partial<MarketContext> = {}): MarketContext {
  return {
    tokenSymbol: 'SOL',
    chain: 'solana',
    whaleBias: 'neutral',
    liquidityTrend: 'stable',
    smartMoneyScore: 55,
    walletQuality: 50,
    tokenScore: 60,
    securityBand: 'good',
    riskScore: 40,
    newsSentiment: 50,
    marketSentiment: 50,
    orderFlowBias: 'mixed',
    volumeScore: 50,
    volatilityPct: 10,
    volumeToLiquidityRatio: 3,
    whaleActivityScore: 40,
    predictionUpsidePct: 5,
    conditionVector: {},
    sources: ['test'],
    fetchedAt: new Date().toISOString(),
    ...over,
  }
}

describe('capital rotation — deterioration', () => {
  it('does not exit on bare price drop without MarketContext confirmation', () => {
    const v = assessDeterioration(intel(), -10, 8)
    assert.equal(v.genuine, false)
    assert.equal(v.noiseOnly, true)
    assert.match(v.reasons.join(' '), /ordinary volatility/i)
  })

  it('exits on threshold + whale distribution + risk', () => {
    const v = assessDeterioration(
      intel({ whaleBias: 'distributing', riskScore: 70, orderFlowBias: 'sell' }),
      -9.5,
      8,
    )
    assert.equal(v.genuine, true)
    assert.equal(v.noiseOnly, false)
    assert.ok(v.reasons.some((r) => /whale distribution/i.test(r)))
  })

  it('never claims zero losses in aggregate honesty note', () => {
    const empty = computeRotationAggregate([])
    assert.match(empty.honestyNote, /not zero losses/i)
    assert.ok(!/no losses|never lose/i.test(empty.honestyNote))

    const events: RotationEvent[] = [
      {
        id: '1',
        wallet: 'w',
        linkedAt: new Date().toISOString(),
        exit: {
          mint: 'm',
          symbol: 'SOL',
          pnlPctFromEntry: -2.7,
          reason: 'whale distribution',
          decisionId: 'd1',
        },
        entry: {
          mint: 'n',
          symbol: 'BONK',
          confidence: 82,
          reason: 'liquidity rising',
          decisionId: 'd2',
        },
        exitResultPct: -2.7,
        entryResultPct: 1.2,
        thresholdPct: 8,
        permissionMode: 'advise_only',
      },
    ]
    const agg = computeRotationAggregate(events)
    assert.equal(agg.lossExitCount, 1)
    assert.equal(agg.avgExitResultPct, -2.7)
    assert.equal(agg.aggregateNetPct, null)
    assert.match(agg.honestyNote, /real exit losses/i)
  })
})
