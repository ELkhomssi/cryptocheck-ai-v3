/**
 * Money Lifecycle V2 — pure derivation + ramp honesty.
 * Run: node --import tsx --test __tests__/terminal-os/money-lifecycle.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  decideActiveStage,
  deriveLifecycle,
} from '../../features/terminal-os/money-lifecycle/derive-lifecycle'
import { resolveRampConfig } from '../../features/terminal-os/money-lifecycle/ramp-links'
import { LIFECYCLE_STAGES } from '../../features/terminal-os/money-lifecycle/types'
import type { LifecycleSnapshot } from '../../features/terminal-os/money-lifecycle/types'

function baseSnap(over: Partial<LifecycleSnapshot> = {}): LifecycleSnapshot {
  return {
    walletConnected: false,
    walletAddress: null,
    cashReadyUsd: null,
    availableSol: null,
    portfolio: null,
    portfolioLoading: false,
    dna: null,
    marketContext: null,
    decision: null,
    executionState: 'building',
    performance: null,
    ramp: { provider: null, buyUrl: null, sellUrl: null, configured: false },
    ...over,
  }
}

describe('money-lifecycle', () => {
  it('defines eight stages', () => {
    assert.equal(LIFECYCLE_STAGES.length, 8)
    assert.deepEqual(
      LIFECYCLE_STAGES.map((s) => s.index),
      [1, 2, 3, 4, 5, 6, 7, 8],
    )
  })

  it('starts at Money Enters when disconnected', () => {
    const d = deriveLifecycle(baseSnap())
    assert.equal(d.activeStageId, 'enters')
    const enters = d.nodes.find((n) => n.meta.id === 'enters')!
    assert.equal(enters.status, 'needs_wallet')
    assert.match(enters.headline, /Connect wallet/i)
  })

  it('never fabricates DNA / decision numbers without data', () => {
    const d = deriveLifecycle(
      baseSnap({
        walletConnected: true,
        walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        cashReadyUsd: 1200,
      }),
    )
    const you = d.nodes.find((n) => n.meta.id === 'you')!
    const market = d.nodes.find((n) => n.meta.id === 'market')!
    const decides = d.nodes.find((n) => n.meta.id === 'decides')!
    assert.equal(you.status, 'insufficient_data')
    assert.match(you.headline, /Not enough data/i)
    assert.equal(market.status, 'insufficient_data')
    assert.equal(decides.status, 'insufficient_data')
    assert.ok(!/\d{2,}%/.test(you.headline))
  })

  it('pulses Executes while ExecutionState is in-flight', () => {
    const snap = baseSnap({
      walletConnected: true,
      executionState: 'broadcasting',
      decision: {
        id: 'd1',
        subject: { kind: 'token', symbol: 'SOL', chain: 'solana' },
        action: 'BUY',
        confidence: 90,
        marketConfidence: 88,
        personalizedConfidence: 90,
        confidenceMode: 'personalized',
        reasoning: 'BUY SOL',
        contributingFactors: [{ engine: 'market-intelligence', summary: 'test', weight: 0.5 }],
        risk: 20,
        expectedROI: 8,
        expectedDrawdown: 4,
        degraded: false,
        computedAt: new Date().toISOString(),
        staleAfter: new Date(Date.now() + 60_000).toISOString(),
      },
    })
    assert.equal(decideActiveStage(snap), 'executes')
    const d = deriveLifecycle(snap)
    assert.equal(d.activeStageId, 'executes')
    assert.equal(d.nodes.find((n) => n.meta.id === 'executes')!.status, 'active')
  })

  it('surfaces real decision headline without recomputing scores', () => {
    const snap = baseSnap({
      walletConnected: true,
      decision: {
        id: 'd2',
        subject: { kind: 'token', symbol: 'BONK', chain: 'solana' },
        action: 'WAIT',
        confidence: 55,
        marketConfidence: 55,
        confidenceMode: 'market',
        reasoning: 'WAIT on BONK',
        contributingFactors: [{ engine: 'market-intelligence', summary: 'No clear edge', weight: 0.4 }],
        risk: 60,
        degraded: false,
        computedAt: new Date().toISOString(),
        staleAfter: new Date(Date.now() + 60_000).toISOString(),
      },
    })
    const d = deriveLifecycle(snap)
    assert.equal(d.activeStageId, 'decides')
    const node = d.nodes.find((n) => n.meta.id === 'decides')!
    assert.match(node.headline, /WAIT, confidence 55%/)
  })

  it('ramp config is honest when no provider keys', () => {
    const prev = {
      moon: process.env.NEXT_PUBLIC_MOONPAY_API_KEY,
      tx: process.env.NEXT_PUBLIC_TRANSAK_API_KEY,
      ramp: process.env.NEXT_PUBLIC_RAMP_API_KEY,
    }
    delete process.env.NEXT_PUBLIC_MOONPAY_API_KEY
    delete process.env.NEXT_PUBLIC_TRANSAK_API_KEY
    delete process.env.NEXT_PUBLIC_RAMP_API_KEY
    try {
      const cfg = resolveRampConfig('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')
      assert.equal(cfg.configured, false)
      assert.equal(cfg.buyUrl, null)
      const d = deriveLifecycle(
        baseSnap({
          walletConnected: true,
          cashReadyUsd: 500,
          ramp: cfg,
        }),
      )
      assert.equal(d.nodes.find((n) => n.meta.id === 'enters')!.status, 'needs_config')
      assert.equal(d.nodes.find((n) => n.meta.id === 'exits')!.status, 'needs_config')
      assert.match(d.nodes.find((n) => n.meta.id === 'exits')!.headline, /Available to Withdraw/)
    } finally {
      if (prev.moon) process.env.NEXT_PUBLIC_MOONPAY_API_KEY = prev.moon
      if (prev.tx) process.env.NEXT_PUBLIC_TRANSAK_API_KEY = prev.tx
      if (prev.ramp) process.env.NEXT_PUBLIC_RAMP_API_KEY = prev.ramp
    }
  })

  it('builds MoonPay URLs when key present', () => {
    const prev = process.env.NEXT_PUBLIC_MOONPAY_API_KEY
    process.env.NEXT_PUBLIC_MOONPAY_API_KEY = 'pk_test_lifecycle'
    try {
      const cfg = resolveRampConfig('DemoWallet1111111111111111111111111111111')
      assert.equal(cfg.configured, true)
      assert.equal(cfg.provider, 'moonpay')
      assert.ok(cfg.buyUrl?.includes('buy.moonpay.com'))
      assert.ok(cfg.buyUrl?.includes('walletAddress='))
      assert.ok(cfg.sellUrl?.includes('sell.moonpay.com'))
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_MOONPAY_API_KEY
      else process.env.NEXT_PUBLIC_MOONPAY_API_KEY = prev
    }
  })
})
