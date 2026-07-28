/**
 * Trade Like Me engine unit tests — pure logic, no UI.
 * Run: node --import tsx --test __tests__/terminal-os/trade-like-me.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildTraderDna, classifyTradingStyles } from '../../features/terminal-os/ai-trade-like-me/engines/trader-dna-engine'
import { decide } from '../../features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { explainDecision } from '../../features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import { AutonomousExecutionEngine } from '../../features/terminal-os/ai-trade-like-me/engines/autonomous-execution-engine'
import { TlmEventBus } from '../../features/terminal-os/ai-trade-like-me/engines/event-bus'
import { buildSampleTradeHistory } from '../../features/terminal-os/ai-trade-like-me/lib/sample-trade-history'
import { TradeLikeMeOrchestrator } from '../../features/terminal-os/ai-trade-like-me/engines/orchestrator'
import type { MarketIntelSnapshot } from '../../features/terminal-os/ai-trade-like-me/types'

describe('Trade Like Me engines', () => {
  it('builds Trader DNA with styles and sample tag', () => {
    const trades = buildSampleTradeHistory('wallet-test')
    const dna = buildTraderDna('wallet-test', trades)
    assert.equal(dna.sample, true)
    assert.ok(dna.tradeCount >= 8)
    assert.ok(dna.styles.length >= 1)
    assert.ok(dna.confidenceScore > 0)
    assert.ok(dna.winRatePct >= 0)
    const styles = classifyTradingStyles(trades)
    assert.ok(styles.every((s) => s.weight >= 8))
  })

  it('produces explainable BUY/WAIT decisions — never black box', () => {
    const trades = buildSampleTradeHistory('w')
    const dna = buildTraderDna('w', trades)
    const intel: MarketIntelSnapshot = {
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
      predictionUpsidePct: 18,
      sources: ['test'],
      fetchedAt: new Date().toISOString(),
    }
    const d = decide(dna, intel)
    assert.ok(['BUY', 'WAIT', 'SELL', 'EXIT', 'DO_NOTHING'].includes(d.action))
    assert.ok(d.reasons.length >= 1)
    assert.ok(d.scores.confidence > 0)
    const n = explainDecision(d)
    assert.equal(n.headline, d.action)
    assert.match(n.confidenceLine, /Confidence/)
    assert.ok(n.footer.includes('Not financial advice'))
  })

  it('disagrees with trader when whales distribute despite behavior match', () => {
    const trades = buildSampleTradeHistory('w')
    const dna = buildTraderDna('w', trades)
    const intel: MarketIntelSnapshot = {
      tokenSymbol: 'BONK',
      chain: 'solana',
      whaleBias: 'distributing',
      liquidityTrend: 'decreasing',
      smartMoneyScore: 40,
      walletQuality: 50,
      tokenScore: 55,
      securityBand: 'caution',
      riskScore: 48,
      newsSentiment: 40,
      marketSentiment: 38,
      orderFlowBias: 'sell',
      volumeScore: 60,
      volatilityPct: 20,
      predictionUpsidePct: -5,
      sources: ['test'],
      fetchedAt: new Date().toISOString(),
    }
    // Force high behavior match path via whale_follower DNA — still WAIT
    dna.styles = [{ tag: 'whale_follower', weight: 80 }, { tag: 'momentum', weight: 20 }]
    dna.favoriteChains = [{ chain: 'solana', weight: 100 }]
    const d = decide(dna, intel)
    assert.equal(d.action, 'WAIT')
    assert.equal(d.improvesTrader, true)
    assert.ok(d.disagreements.length >= 1)
  })

  it('blocks autonomy when feature flags are OFF', () => {
    const bus = new TlmEventBus()
    const auto = new AutonomousExecutionEngine(bus)
    auto.updateConfig({ enabled: true, confidenceThreshold: 50 })
    const trades = buildSampleTradeHistory('w')
    const dna = buildTraderDna('w', trades)
    const intel: MarketIntelSnapshot = {
      tokenSymbol: 'SOL',
      chain: 'solana',
      whaleBias: 'accumulating',
      liquidityTrend: 'increasing',
      smartMoneyScore: 70,
      walletQuality: 80,
      tokenScore: 90,
      securityBand: 'excellent',
      riskScore: 20,
      newsSentiment: 60,
      marketSentiment: 65,
      orderFlowBias: 'buy',
      volumeScore: 85,
      volatilityPct: 3,
      predictionUpsidePct: 8,
      sources: ['test'],
      fetchedAt: new Date().toISOString(),
    }
    const d = decide(dna, intel)
    const plan = auto.plan(d, {
      autonomousTrading: false,
      copyTrading: false,
      realSwapExecution: false,
    })
    assert.equal(plan.wouldExecute, false)
    assert.ok(plan.blockedReason?.includes('flagged OFF'))
  })

  it('orchestrator trains and emits DNA via event bus', () => {
    const bus = new TlmEventBus()
    const orch = new TradeLikeMeOrchestrator(bus)
    let dnaEvents = 0
    bus.subscribe('tlm.dna.updated', () => {
      dnaEvents += 1
    })
    const trades = buildSampleTradeHistory('orch-w')
    orch.trainFromWallet('orch-w', trades)
    const state = orch.getState({
      autonomousTrading: false,
      copyTrading: false,
      realSwapExecution: false,
    })
    assert.ok(state.dna)
    assert.equal(state.dna!.sample, true)
    assert.ok(state.learningProgressPct >= 100)
    assert.ok(dnaEvents >= 1)
  })
})
