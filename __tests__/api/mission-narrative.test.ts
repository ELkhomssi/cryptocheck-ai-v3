import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  activeProofAt,
  buildDynamicSuggestions,
  buildMissionConversation,
  buildPortfolioNarrative,
  buildReconstruction,
  runningIntelligenceLabel,
  speechHoldMs,
  timelineHeadline,
} from '../../lib/portfolio-desk/mission-narrative'
import type { MissionViewModel, TimelineEvent } from '../../types/intelligence-core'

const emptyView = (): MissionViewModel => ({
  market: {
    available: false,
    aggregateChange24hPct: null,
    topMoverSymbol: null,
    topMoverChange24hPct: null,
    spark: [],
  },
  portfolio: {
    connected: false,
    totalValueUsd: null,
    dayChangePct: null,
    topWeightSymbol: null,
    error: null,
  },
  running: [],
  recommendations: [],
  dailyBrief: {
    title: 'Morning Brief',
    body: 'Not enough activity yet.',
    insufficientActivity: true,
    pending: false,
    reportId: null,
  },
  fetchedAt: new Date().toISOString(),
})

describe('Mission Control conversation', () => {
  it('reconstructs from real engines before speech', () => {
    const steps = buildReconstruction({ view: emptyView(), loading: false })
    assert.ok(steps.some((s) => s.engine.includes('Market')))
    assert.ok(steps.some((s) => s.engine.includes('Portfolio')))
    assert.ok(steps.every((s) => s.done))
    const loading = buildReconstruction({ view: null, loading: true })
    assert.ok(loading.every((s) => /Reconstructing/i.test(s.status)))
  })

  it('speaks filtered conclusions with proof tags — no marketing presence line', () => {
    const conv = buildMissionConversation({
      displayName: 'Abderrahim',
      view: emptyView(),
      loading: false,
    })
    assert.match(conv.turns[0]!.text, /Good (morning|afternoon|evening) Abderrahim/)
    assert.ok(conv.turns.every((t) => t.proof && 'meaning' in t))
    assert.doesNotMatch(conv.turns.map((t) => t.text).join(' '), /already been working for you/i)
    const propose = conv.turns.find((t) => t.kind === 'propose')
    assert.match(propose?.text ?? '', /filtered everything else/i)
    assert.equal(propose?.proof, 'actions')
    assert.equal(activeProofAt(conv.turns, conv.turns.length), 'actions')
  })

  it('keeps numbers out of speech — meaning first', () => {
    const v = emptyView()
    v.market.available = true
    v.market.aggregateChange24hPct = 3.25
    v.market.topMoverSymbol = 'WIF'
    v.market.topMoverChange24hPct = 12
    v.portfolio.connected = true
    v.portfolio.totalValueUsd = 50000
    v.portfolio.dayChangePct = 0.5
    v.portfolio.topWeightSymbol = 'BONK'
    v.dailyBrief.insufficientActivity = false
    const conv = buildMissionConversation({ displayName: null, view: v, loading: false })
    const speech = conv.turns.map((t) => t.text).join(' ')
    assert.match(speech, /strengthening|healthy|orderly/i)
    assert.doesNotMatch(speech, /\+3\.25%/)
    assert.doesNotMatch(speech, /\$50/)
    assert.equal(conv.riskSymbol, 'BONK')
    assert.ok(conv.marketMetrics.length > 0)
  })

  it('quiet day stays calm', () => {
    const conv = buildMissionConversation({
      displayName: null,
      view: emptyView(),
      loading: false,
    })
    assert.match(conv.turns.map((t) => t.text).join(' '), /relatively quiet/i)
  })

  it('speech hold gives time for proof absorption', () => {
    assert.ok(speechHoldMs('Hi.') >= 1600)
    assert.ok(speechHoldMs('The market is strengthening today under pressure.') > speechHoldMs('Hi.'))
  })

  it('prepared actions stay institutional', () => {
    const v = emptyView()
    v.portfolio.connected = true
    v.portfolio.topWeightSymbol = 'BONK'
    const s = buildDynamicSuggestions(v)
    assert.equal(s[0], 'Show hidden risks')
  })

  it('living copy uses institutional voice', () => {
    assert.match(
      runningIntelligenceLabel('liquidity scan across pools', 'scan'),
      /analyzing liquidity/i,
    )
  })

  it('portfolio narrative does not lead with balances', () => {
    const v = emptyView()
    v.portfolio.connected = true
    v.portfolio.totalValueUsd = 99999
    v.portfolio.dayChangePct = 1
    v.portfolio.topWeightSymbol = 'WIF'
    const n = buildPortfolioNarrative(v)
    assert.match(n.healthLine, /healthy|operable|pressure|risk/i)
    assert.ok(n.weakness)
  })

  it('timeline headlines read like memory', () => {
    const ev = {
      id: '1',
      sourceTable: 'portfolio_alerts',
      sourceId: 'a',
      eventType: 'alert:risk',
      summary: 'Alert: risk score improved',
      module: 'security',
      createdAt: new Date().toISOString(),
    } satisfies TimelineEvent
    assert.match(timelineHeadline(ev), /risk improved|Risk updated/i)
  })
})
