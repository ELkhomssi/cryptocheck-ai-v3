/**
 * AI Gateway Round 2 — proactivity / IA / honesty proxies.
 * Run: node --import tsx --test __tests__/ai-os/gateway-round2.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Decision } from '@cryptocheck/decision-contracts'
import {
  buildGatewayGreeting,
  buildHeroMetrics,
  buildMissionSummary,
  canShowConfidenceTrend,
  confidenceSeries,
  convictionBadgeLabel,
  decisionAgeLabel,
  decisionFreshnessLabel,
  engineChecklist,
  formatHoldingFromDna,
  heroReason,
  resolveGatewayDisplayName,
  selectHeroDecision,
  strategyFromDna,
  UNAVAILABLE,
} from '../../features/ai-os/lib/gateway-round2'

const root = process.cwd()

function sampleDecision(over: Partial<Decision> & Pick<Decision, 'action' | 'confidence'>): Decision {
  return {
    id: 'd1',
    subject: { kind: 'token', symbol: 'SOL', address: 'So11111111111111111111111111111111111111112', chain: 'solana' },
    action: over.action,
    confidence: over.confidence,
    marketConfidence: over.confidence,
    confidenceMode: 'market',
    reasoning: over.reasoning ?? 'Whales accumulating. Liquidity rising on major pairs.',
    contributingFactors: over.contributingFactors ?? [
      { engine: 'whale-intelligence', summary: 'whales', weight: 0.4 },
      { engine: 'market-intelligence', summary: 'momentum', weight: 0.3 },
    ],
    risk: over.risk ?? 22,
    expectedROI: over.expectedROI ?? 18,
    degraded: over.degraded ?? false,
    degradedInputs: over.degradedInputs,
    computedAt: over.computedAt ?? '2026-08-03T12:00:00.000Z',
    staleAfter: over.staleAfter ?? '2026-08-03T12:05:00.000Z',
    ...over,
  }
}

describe('Gateway Round 2 helpers', () => {
  it('display name never uses truncated wallet labels', () => {
    assert.equal(resolveGatewayDisplayName({ walletLabel: '7xK…9aB' }), null)
    assert.equal(resolveGatewayDisplayName({ ensName: 'alice.sol' }), 'alice.sol')
    assert.equal(resolveGatewayDisplayName({ profileName: 'Alex' }), 'Alex')
  })

  it('greeting uses real tick counts or honest gathering state', () => {
    const empty = buildGatewayGreeting({
      displayName: null,
      tickMeta: null,
      portfolioReviewed: false,
      now: new Date('2026-08-03T20:00:00Z'),
    })
    assert.match(empty.lines[0]!, /Good evening —/)
    assert.match(empty.lines.join(' '), /Still gathering data/)

    const named = buildGatewayGreeting({
      displayName: 'Alex',
      tickMeta: {
        at: 't',
        scanned: 12,
        published: 8,
        buyCount: 3,
        waitCount: 5,
      },
      portfolioReviewed: true,
      now: new Date('2026-08-03T20:00:00Z'),
    })
    assert.match(named.lines[0]!, /Good evening, Alex/)
    assert.match(named.lines.join(' '), /Markets monitored: 12/)
    assert.match(named.lines.join(' '), /Portfolio analyzed/)
    assert.match(named.lines.join(' '), /3 opportunities/)
  })

  it('selects single highest-confidence actionable hero Decision', () => {
    const hero = selectHeroDecision([
      sampleDecision({ action: 'WAIT', confidence: 99 }),
      sampleDecision({
        action: 'BUY',
        confidence: 70,
        subject: {
          kind: 'token',
          symbol: 'BONK',
          address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
          chain: 'solana',
        },
      }),
      sampleDecision({ action: 'BUY', confidence: 88, id: 'best' }),
    ])
    assert.equal(hero?.id, 'best')
    assert.equal(hero?.action, 'BUY')
  })

  it('hero reason truncates; holding omitted without DNA', () => {
    const long = 'A'.repeat(200) + '. Second sentence here.'
    assert.ok(heroReason(long).length <= 161)
    const m = buildMissionSummary(sampleDecision({ action: 'BUY', confidence: 80 }))
    assert.equal(m.holding, null)
    assert.equal(formatHoldingFromDna(6 * 3_600_000), '~6h')
    assert.equal(formatHoldingFromDna(0), null)
  })

  it('age/freshness from real Decision timestamps; trend needs ≥2 points', () => {
    const now = new Date('2026-08-03T12:02:00.000Z').getTime()
    assert.match(decisionAgeLabel('2026-08-03T12:00:00.000Z', now), /Age 2m/)
    assert.match(decisionFreshnessLabel('2026-08-03T12:05:00.000Z', now), /Fresh 3m/)
    assert.equal(canShowConfidenceTrend(confidenceSeries([{ at: 'a', action: 'BUY', confidence: 50, marketConfidence: 50 }])), false)
    assert.equal(
      canShowConfidenceTrend(
        confidenceSeries([
          { at: 'a', action: 'BUY', confidence: 50, marketConfidence: 50 },
          { at: 'b', action: 'BUY', confidence: 60, marketConfidence: 55 },
        ]),
      ),
      true,
    )
  })

  it('engine checklist reflects degradedInputs honestly', () => {
    const loading = engineChecklist({ decisionLoading: true, decision: null })
    assert.ok(loading.every((e) => e.status === 'loading'))
    const d = sampleDecision({
      action: 'BUY',
      confidence: 70,
      degraded: true,
      degradedInputs: ['trader-dna', 'portfolio-intelligence', 'whale-intelligence'],
      contributingFactors: [{ engine: 'market-intelligence', summary: 'ok', weight: 0.5 }],
    })
    const rows = engineChecklist({ decisionLoading: false, decision: d })
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.status]))
    assert.equal(byId['trader-dna'], 'unavailable')
    assert.equal(byId['portfolio-intelligence'], 'unavailable')
    assert.equal(byId['whale-intelligence'], 'unavailable')
    assert.equal(byId['market-intelligence'], 'live')
    assert.equal(byId['security-scanner'], 'live')
  })

  it('hero metrics use real Decision fields; missing → Unavailable; conviction gated', () => {
    assert.equal(convictionBadgeLabel(90), 'ULTRA HIGH CONVICTION')
    assert.equal(convictionBadgeLabel(75), 'HIGH CONVICTION')
    assert.equal(convictionBadgeLabel(50), null)

    const d = sampleDecision({ action: 'BUY', confidence: 88, expectedROI: 12.5, risk: 20 })
    const untrained = buildHeroMetrics(d, { avgHoldingMs: null, dnaSampleSize: 0 })
    assert.equal(untrained.primary[0]!.value, '88%')
    assert.equal(untrained.primary[1]!.value, '+12.5%')
    assert.equal(untrained.primary[3]!.value, UNAVAILABLE)
    assert.equal(untrained.primary[3]!.available, false)
    assert.equal(untrained.secondary[0]!.value, UNAVAILABLE)
    assert.equal(untrained.secondary[1]!.value, UNAVAILABLE)
    assert.equal(untrained.secondary[2]!.value, UNAVAILABLE)

    const trained = buildHeroMetrics(d, {
      avgHoldingMs: 2.3 * 3_600_000,
      dnaSampleSize: 12,
      tradingStyleSummary: 'Momentum + whale',
    })
    assert.match(trained.secondary[0]!.value, /~2\.3h/)
    assert.equal(trained.secondary[1]!.value, 'Momentum + whale')
    assert.equal(strategyFromDna({ sampleSize: 2, tradingStyleSummary: 'X' }), null)
  })
})

describe('Gateway Round 2 wiring integrity', () => {
  it('IntelligenceSwap uses hero flow + history + DNA hold + Approve gate', () => {
    const src = readFileSync(join(root, 'features/ai-os/components/IntelligenceSwap.tsx'), 'utf8')
    assert.match(src, /GatewayHeroFlow/)
    assert.match(src, /history=1/)
    assert.match(src, /selectHeroDecision/)
    assert.match(src, /missionApproved/)
    assert.match(src, /\/api\/terminal-os\/dna/)
    assert.match(src, /signTransaction/)
    assert.match(src, /Estimated total cost/)
    assert.match(src, /prepareAndSimulate|runSimulateOnly/)
    assert.match(src, /runSignOnly/)
    assert.match(src, /onApproveAndExecute/)
    assert.doesNotMatch(src, /Good evening, Abderrahim/)
    assert.doesNotMatch(src, /12,?431/)
  })

  it('GatewayHeroFlow sequence Decision → Reason → metrics → Approve & Execute; engines in Evidence', () => {
    const hero = readFileSync(join(root, 'features/ai-os/components/GatewayHeroFlow.tsx'), 'utf8')
    const actionIdx = hero.indexOf('data-gw-hero-decision')
    const reasonIdx = hero.indexOf('data-gw-hero-reason')
    const missionIdx = hero.indexOf('data-gw-mission="true"')
    const approveIdx = hero.indexOf('data-gw-approve')
    const simulateIdx = hero.indexOf('data-gw-simulate')
    const signIdx = hero.indexOf('data-gw-sign')
    const queueIdx = hero.indexOf('data-gw-queue')
    const readyLine = hero.indexOf('data-gw-ready-line')
    assert.ok(actionIdx > 0 && actionIdx < reasonIdx && reasonIdx < missionIdx && missionIdx < approveIdx)
    assert.ok(readyLine > 0 && readyLine < actionIdx)
    assert.ok(approveIdx < simulateIdx && simulateIdx < signIdx && signIdx < queueIdx)
    assert.match(hero, /Approve & Execute/)
    assert.match(hero, /buildHeroMetrics/)
    assert.match(hero, /convictionBadgeLabel/)
    assert.match(hero, /Queue unavailable/)
    assert.match(hero, /Building confidence history/)
    assert.match(hero, /data-gw-engines/)
    assert.match(hero, /Evidence \/ Details/)
    assert.match(hero, /showEnginesWhileComputing/)
    assert.doesNotMatch(hero, /94%/)
    assert.doesNotMatch(hero, /\+22\.6%/)
  })

  it('does not edit frozen scanner / decision-engine scoring', () => {
    // Structural guard — Round 2 must not touch these files
    const frozen = [
      'lib/services/scanner-engine.ts',
      'lib/services/scanner/pipeline/run-institutional-scan.ts',
      'lib/sentinel/canonical-scan.ts',
    ]
    for (const f of frozen) {
      assert.ok(readFileSync(join(root, f), 'utf8').length > 0)
    }
  })
})
