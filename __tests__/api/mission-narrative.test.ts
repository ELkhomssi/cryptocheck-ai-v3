import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  activeProofAt,
  buildDynamicSuggestions,
  buildMissionConversation,
  buildPortfolioNarrative,
  proofsUnlockedThrough,
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
  it('tags speech with proof surfaces the UI must unlock', () => {
    const conv = buildMissionConversation({
      displayName: 'Abderrahim',
      view: emptyView(),
      loading: false,
    })
    assert.match(conv.turns[0]!.text, /Good (morning|afternoon|evening) Abderrahim/)
    assert.ok(conv.turns.every((t) => t.proof))
    assert.ok(conv.turns.some((t) => t.proof === 'living'))
    assert.ok(conv.turns.some((t) => t.proof === 'feed'))
    assert.ok(conv.turns.some((t) => t.proof === 'actions'))
    const propose = conv.turns.find((t) => t.kind === 'propose')
    assert.match(propose?.text ?? '', /prepared \d+ actions/i)
    assert.equal(propose?.proof, 'actions')
  })

  it('unlocks proofs in speech order', () => {
    const conv = buildMissionConversation({
      displayName: null,
      view: emptyView(),
      loading: false,
    })
    const unlocked = proofsUnlockedThrough(conv.turns, conv.turns.length)
    assert.ok(unlocked.includes('living'))
    assert.ok(unlocked.includes('feed'))
    assert.ok(unlocked.includes('actions'))
    assert.equal(activeProofAt(conv.turns, conv.turns.length), 'actions')
  })

  it('never puts metric dumps in speech — metrics stay in proof data', () => {
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
    assert.match(speech, /reviewed your portfolio/i)
    assert.match(speech, /BONK/)
    assert.doesNotMatch(speech, /\+3\.25%/)
    assert.doesNotMatch(speech, /\$50/)
    assert.equal(conv.riskSymbol, 'BONK')
    assert.ok(conv.marketMetrics.length > 0)
    assert.ok(conv.portfolioMetrics.length > 0)
  })

  it('quiet day stays calm and still drives feed proof', () => {
    const conv = buildMissionConversation({
      displayName: null,
      view: emptyView(),
      loading: false,
    })
    const blob = conv.turns.map((t) => t.text).join(' ')
    assert.match(blob, /relatively quiet/i)
    assert.doesNotMatch(blob, /No activity/i)
    assert.doesNotMatch(blob, /already been working for you/i)
  })

  it('speech hold scales with sentence length', () => {
    assert.ok(speechHoldMs('Hi.') < speechHoldMs('I reviewed your portfolio in detail today.'))
  })

  it('prepared actions are a short institutional set', () => {
    const v = emptyView()
    v.portfolio.connected = true
    v.portfolio.topWeightSymbol = 'BONK'
    v.market.available = true
    v.market.aggregateChange24hPct = 3
    const s = buildDynamicSuggestions(v)
    assert.equal(s[0], 'Show hidden risks')
    assert.ok(s.includes('Scan a token'))
  })

  it('living copy uses institutional voice when real jobs exist', () => {
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
