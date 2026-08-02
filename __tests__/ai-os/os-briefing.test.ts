/**
 * Pure helpers for AI OS recommendation copy.
 * Run: node --import tsx --test __tests__/ai-os/os-briefing.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Decision } from '@cryptocheck/decision-contracts'
import { greetingForNow } from '../../features/ai-os/lib/greeting'
import { OS_INTENTS } from '../../features/ai-os/lib/intents'

function pickRecommendation(decisions: Decision[]) {
  if (!decisions.length) {
    return { kind: 'unavailable' as const, headline: 'Decision Engine has not published a recommendation yet.' }
  }
  const buy = decisions.find(
    (d) => d.action === 'BUY' && (d.marketConfidence ?? d.confidence) >= 70,
  )
  if (buy) {
    const symbol = buy.subject.kind === 'token' ? buy.subject.symbol : null
    return {
      kind: 'opportunity' as const,
      headline: `I found one high-confidence opportunity${symbol ? ` on $${symbol}` : ''}.`,
      confidence: buy.marketConfidence ?? buy.confidence,
    }
  }
  return {
    kind: 'wait' as const,
    headline: 'I recommend waiting.',
    confidence: decisions[0]!.marketConfidence ?? decisions[0]!.confidence,
  }
}

function decision(over: Partial<Decision> & Pick<Decision, 'id' | 'action' | 'confidence' | 'marketConfidence'>): Decision {
  return {
    subject: { kind: 'token', symbol: 'SOL', chain: 'solana' },
    confidenceMode: 'market',
    reasoning: 'test',
    contributingFactors: [],
    risk: 20,
    degraded: false,
    computedAt: new Date().toISOString(),
    staleAfter: new Date(Date.now() + 60_000).toISOString(),
    ...over,
  }
}

describe('ai-os briefing helpers', () => {
  it('greets by time of day', () => {
    assert.match(greetingForNow(new Date('2026-08-02T09:00:00')), /morning/i)
    assert.match(greetingForNow(new Date('2026-08-02T15:00:00')), /afternoon/i)
    assert.match(greetingForNow(new Date('2026-08-02T21:00:00')), /evening/i)
  })

  it('exposes five gateway intents', () => {
    assert.equal(OS_INTENTS.length, 5)
    assert.ok(OS_INTENTS.every((i) => i.label.startsWith('I want')))
  })

  it('recommends wait when no high-confidence BUY', () => {
    const r = pickRecommendation([
      decision({ id: '1', action: 'WAIT', confidence: 62, marketConfidence: 62 }),
    ])
    assert.equal(r.kind, 'wait')
    assert.match(r.headline, /waiting/i)
  })

  it('surfaces opportunity only at marketConfidence ≥ 70 BUY', () => {
    const low = pickRecommendation([
      decision({ id: '1', action: 'BUY', confidence: 65, marketConfidence: 65 }),
    ])
    assert.equal(low.kind, 'wait')

    const high = pickRecommendation([
      decision({
        id: '2',
        action: 'BUY',
        confidence: 78,
        marketConfidence: 78,
        subject: { kind: 'token', symbol: 'BONK', chain: 'solana' },
      }),
    ])
    assert.equal(high.kind, 'opportunity')
    assert.match(high.headline, /BONK/)
    assert.equal(high.confidence, 78)
  })

  it('never fabricates a recommendation from an empty Decision store', () => {
    const r = pickRecommendation([])
    assert.equal(r.kind, 'unavailable')
  })
})
