import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prioritizeAttentionItems } from '../../features/attention-feed/lib/prioritize'
import { filterWorkspaceItems } from '../../features/attention-feed/lib/filter-workspace'
import { SIMPLE_VOCAB } from '../../features/attention-feed/lib/vocab'
import { resolveForcedModeFromSearch } from '../../features/attention-feed/stores/presentation-mode'
import type { AttentionItem } from '../../features/attention-feed/types'
import { adaptWhalesToAttention } from '../../features/attention-feed/adapters/whale-adapter'
import type { WhaleMovement } from '../../features/terminal-os/shared/types'

function item(partial: Partial<AttentionItem> & Pick<AttentionItem, 'id' | 'urgency' | 'rankScore'>): AttentionItem {
  return {
    sourceEngine: 'market-intelligence',
    headline: partial.headline ?? partial.id,
    reality: 'r',
    analysis: 'a',
    evidence: [],
    createdAt: partial.createdAt ?? '2026-07-30T00:00:00.000Z',
    ...partial,
  }
}

describe('attention-feed prioritize', () => {
  it('ranks now before today/fyi and caps at limit', () => {
    const out = prioritizeAttentionItems(
      [
        item({ id: 'fyi', urgency: 'fyi', rankScore: 99 }),
        item({ id: 'now', urgency: 'now', rankScore: 10 }),
        item({ id: 'today', urgency: 'today', rankScore: 50 }),
        item({ id: 'now2', urgency: 'now', rankScore: 80 }),
      ],
      3,
    )
    assert.equal(out.length, 3)
    assert.equal(out[0]!.id, 'now2')
    assert.equal(out[1]!.id, 'now')
    assert.equal(out[2]!.id, 'today')
  })
})

describe('presentation mode URL force', () => {
  it('forces pro for Dubai demo flags', () => {
    assert.equal(resolveForcedModeFromSearch('mode=pro'), 'pro')
    assert.equal(resolveForcedModeFromSearch('?demo=pro'), 'pro')
    assert.equal(resolveForcedModeFromSearch('mode=simple'), 'simple')
    assert.equal(resolveForcedModeFromSearch(''), null)
  })
})

describe('whale adapter sample hygiene', () => {
  it('drops sample whales from the attention feed', () => {
    const whales = [
      {
        id: '1',
        sample: true,
        aiConfidence: 90,
        smartMoney: true,
        smartMoneyScore: 90,
        impactScore: 80,
        walletTruncated: '7a…',
        walletFull: 'x',
        chain: 'solana',
        action: 'buy',
        assetSymbol: 'WIF',
        usdValue: 1_000_000,
        amount: 1,
        occurredAt: '2026-07-30T00:00:00.000Z',
        classification: 'Accumulation',
        classificationWhy: 'x',
        avatarInitials: 'SM',
        previousHoldingsUsd: null,
        currentPortfolioUsd: null,
        historicalWinRatePct: null,
        pnlUsd: null,
        aiReasoning: 'sample',
      },
      {
        id: '2',
        sample: false,
        aiConfidence: 80,
        smartMoney: true,
        smartMoneyScore: 88,
        impactScore: 70,
        walletTruncated: '9b…',
        walletFull: 'y',
        chain: 'solana',
        action: 'sell',
        assetSymbol: 'SOL',
        usdValue: 500_000,
        amount: 1,
        occurredAt: '2026-07-30T01:00:00.000Z',
        classification: 'Distribution',
        classificationWhy: 'real',
        avatarInitials: 'WH',
        previousHoldingsUsd: null,
        currentPortfolioUsd: null,
        historicalWinRatePct: null,
        pnlUsd: null,
        aiReasoning: 'live flow',
      },
    ] as WhaleMovement[]
    const items = adaptWhalesToAttention(whales)
    assert.equal(items.length, 1)
    assert.equal(items[0]!.id, 'whale:2')
  })
})

describe('simple mode workspace filters', () => {
  it('filters discovery to high-conviction only', () => {
    const out = filterWorkspaceItems(
      [
        item({
          id: 'low',
          urgency: 'today',
          rankScore: 40,
          sourceEngine: 'market-intelligence',
          recommendation: { action: 'Watch', confidence: 40 },
        }),
        item({
          id: 'high',
          urgency: 'now',
          rankScore: 88,
          sourceEngine: 'decision-engine',
          recommendation: { action: 'BUY WIF', confidence: 91 },
        }),
        item({
          id: 'coach',
          urgency: 'fyi',
          rankScore: 90,
          sourceEngine: 'ai-coach',
          recommendation: { action: 'Teach', confidence: 90 },
        }),
      ],
      'discovery',
    )
    assert.equal(out.length, 1)
    assert.equal(out[0]!.id, 'high')
  })

  it('keeps Simple vocabulary free of Pro labels', () => {
    assert.equal(SIMPLE_VOCAB.connectWallet, 'Secure Account')
    assert.equal(SIMPLE_VOCAB.quickSwap, 'AI Execution')
    assert.ok(!Object.values(SIMPLE_VOCAB).some((v) => /jupiter|priority fee|quick swap|connect wallet/i.test(v)))
  })
})
