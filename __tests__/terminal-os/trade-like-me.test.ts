/**
 * Trade Like Me V2 engine tests.
 * Run: node --import tsx --test __tests__/terminal-os/trade-like-me.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTraderDna,
  computeStyleVector,
} from '../../features/terminal-os/ai-trade-like-me/engines/trader-dna-engine'
import { decide } from '../../features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { explainDecision } from '../../features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import { AutonomousExecutionEngine } from '../../features/terminal-os/ai-trade-like-me/engines/autonomous-execution-engine'
import { TlmEventBus } from '../../features/terminal-os/ai-trade-like-me/engines/event-bus'
import { buildSampleTradeHistory } from '../../features/terminal-os/ai-trade-like-me/lib/sample-trade-history'
import { TradeLikeMeOrchestrator } from '../../features/terminal-os/ai-trade-like-me/engines/orchestrator'
import { computeConfidence, cosineSimilarity } from '../../features/terminal-os/ai-trade-like-me/lib/scoring'
import {
  contributeAnonymized,
  queryCollectiveSignal,
  __resetCollectiveClustersForTests,
} from '../../features/terminal-os/ai-trade-like-me/engines/collective-intelligence-engine'
import { buildPerformanceReport } from '../../features/terminal-os/ai-trade-like-me/engines/performance-analytics-engine'
import type { MarketContext } from '../../features/terminal-os/ai-trade-like-me/types'

function baseIntel(over: Partial<MarketContext> = {}): MarketContext {
  return {
    tokenSymbol: 'WIF',
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

describe('Trade Like Me V2', () => {
  it('builds DNA with style vector summing to ~1 and sampleSize including rejections', () => {
    const trades = buildSampleTradeHistory('wallet-test')
    const dna = buildTraderDna('wallet-test', trades)
    assert.equal(dna.sample, true)
    assert.ok(dna.sampleSize >= 10)
    assert.ok(dna.rejectionCount >= 2)
    assert.ok(dna.confidence > 0)
    assert.equal(dna.confidenceScore, dna.confidence)
    const v = computeStyleVector(trades)
    const sum = Object.values(v).reduce((a, b) => a + b, 0)
    assert.ok(Math.abs(sum - 1) < 0.02)
  })

  it('computeConfidence is inspectable and not an LLM black box', () => {
    const c = computeConfidence({
      behaviorMatch: 90,
      marketQuality: 80,
      probability: 75,
      timing: 70,
      executionQuality: 80,
      risk: 30,
    })
    assert.ok(c >= 50 && c <= 97)
    const sim = cosineSimilarity({ a: 1, b: 0 }, { a: 1, b: 0 })
    assert.equal(sim, 100)
  })

  it('explanations cite TraderDNA / MarketContext fields', () => {
    const trades = buildSampleTradeHistory('w')
    const dna = buildTraderDna('w', trades)
    const d = decide(dna, baseIntel())
    assert.ok(d.citations.length >= 1)
    assert.ok(d.reasons.length >= 1)
    const n = explainDecision(d)
    assert.ok(n.citations.length >= 1)
    assert.match(n.confidenceLine, /Confidence/)
  })

  it('raises visually-distinct disagreement when whales distribute', () => {
    const trades = buildSampleTradeHistory('w')
    const dna = buildTraderDna('w', trades)
    dna.styleVector.whaleFollower = 0.4
    dna.styleVector.momentum = 0.3
    const d = decide(dna, baseIntel({ whaleBias: 'distributing', liquidityTrend: 'decreasing' }))
    assert.equal(d.action, 'WAIT')
    assert.equal(d.improvesTrader, true)
    assert.ok(d.disagreement)
    assert.ok(d.disagreement!.marketDeviationCited.length >= 1)
  })

  it('blocks autonomy and writes audit log', () => {
    const bus = new TlmEventBus()
    const auto = new AutonomousExecutionEngine(bus)
    auto.updateConfig({ enabled: true, confidenceThreshold: 50 })
    const trades = buildSampleTradeHistory('w')
    const dna = buildTraderDna('w', trades)
    const d = decide(dna, baseIntel())
    const plan = auto.plan(
      d,
      { autonomousTrading: false, copyTrading: false, realSwapExecution: false },
      dna,
    )
    assert.equal(plan.wouldExecute, false)
    assert.ok(plan.audit)
    assert.ok(auto.getAuditLog().length >= 1)
  })

  it('collective intelligence requires opt-in and never stores wallet', () => {
    __resetCollectiveClustersForTests()
    const trades = buildSampleTradeHistory('secret-wallet-xyz')
    const dna = buildTraderDna('secret-wallet-xyz', trades)
    assert.equal(
      contributeAnonymized({ optedIn: false, updatedAt: '' }, dna, 12),
      false,
    )
    assert.equal(
      contributeAnonymized({ optedIn: true, updatedAt: '' }, dna, 12),
      true,
    )
    // Contribute more for cluster query
    for (let i = 0; i < 4; i++) {
      contributeAnonymized({ optedIn: true, updatedAt: '' }, dna, 10 + i)
    }
    const sig = queryCollectiveSignal(
      { optedIn: true, updatedAt: '' },
      dna,
      baseIntel(),
    )
    assert.ok(sig)
    assert.equal(sig!.anonymized, true)
    assert.equal(sig!.consentRequired, true)
    assert.ok(!JSON.stringify(sig).includes('secret-wallet'))
  })

  it('performance report includes proof line for autonomy upgrade', () => {
    const trades = buildSampleTradeHistory('w')
    const dna = buildTraderDna('w', trades)
    const r = buildPerformanceReport(trades, dna)
    assert.ok(r.proofLine.length > 20)
    assert.ok(r.opportunitiesAnalyzed >= trades.length)
  })

  it('orchestrator trains and emits DNAUpdated', () => {
    const bus = new TlmEventBus()
    const orch = new TradeLikeMeOrchestrator(bus)
    let dnaEvents = 0
    bus.subscribe('DNAUpdated', () => {
      dnaEvents += 1
    })
    orch.trainFromWallet('orch-w', buildSampleTradeHistory('orch-w'))
    const state = orch.getState({
      autonomousTrading: false,
      copyTrading: false,
      realSwapExecution: false,
    })
    assert.ok(state.dna)
    assert.ok(state.dna!.sampleSize >= 10)
    assert.ok(state.performance)
    assert.ok(dnaEvents >= 1)
  })
})
