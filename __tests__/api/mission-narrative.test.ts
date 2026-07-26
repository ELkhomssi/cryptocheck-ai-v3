import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildDynamicSuggestions,
  buildMissionConversation,
  buildPortfolioNarrative,
  runningIntelligenceLabel,
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
  it('OS speaks first and proposes prepared actions — never open-ended ask', () => {
    const conv = buildMissionConversation({
      displayName: 'Abderrahim',
      view: emptyView(),
      loading: false,
    })
    assert.match(conv.turns[0]!.text, /Good (morning|afternoon|evening) Abderrahim/)
    assert.equal(
      conv.turns.find((t) => t.id === 'presence')?.text,
      'I have already been working for you.',
    )
    assert.ok(conv.turns.some((t) => t.id === 'away'))
    assert.ok(conv.turns.some((t) => t.id === 'ready'))
    const propose = conv.turns.find((t) => t.kind === 'propose')
    assert.equal(propose?.text, 'I already have several actions prepared. Choose one…')
    assert.doesNotMatch(conv.turns.map((t) => t.text).join(' '), /What would you like me to do/i)
    assert.ok(conv.preparedActions.includes('Review my portfolio'))
    assert.ok(conv.preparedActions.includes("Explain today's market"))
    assert.equal(conv.preparedActions.length, 5)
  })

  it('quiet day stays calm — never empty software copy', () => {
    const conv = buildMissionConversation({
      displayName: null,
      view: emptyView(),
      loading: false,
    })
    const blob = conv.turns.map((t) => t.text).join(' ')
    assert.match(blob, /relatively quiet/i)
    assert.doesNotMatch(blob, /No activity/i)
    assert.doesNotMatch(blob, /whale accumulation increased/i)
  })

  it('never puts metric dumps in speech', () => {
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
    assert.match(speech, /BONK/)
    assert.doesNotMatch(speech, /\+3\.25%/)
    assert.doesNotMatch(speech, /\$50/)
    assert.ok(conv.marketMetrics.length > 0)
    assert.ok(conv.portfolioMetrics.length > 0)
    assert.ok(conv.evidence.length > 0)
  })

  it('living copy uses institutional voice when real jobs exist', () => {
    assert.match(
      runningIntelligenceLabel('liquidity scan across pools', 'scan'),
      /analyzing liquidity/i,
    )
    assert.match(
      runningIntelligenceLabel('morning brief generation', 'report'),
      /report is still being prepared/i,
    )
    assert.equal(
      runningIntelligenceLabel('Watching 214 whales across tracked wallets', 'watch'),
      'I’m monitoring 214 whale wallets that moved while you were away.',
    )
  })

  it('prepared actions stay a fixed institutional set', () => {
    const v = emptyView()
    v.portfolio.connected = true
    v.portfolio.topWeightSymbol = 'BONK'
    v.market.available = true
    v.market.aggregateChange24hPct = 3
    const s = buildDynamicSuggestions(v)
    assert.equal(s[0], 'Show hidden risks')
    assert.ok(s.includes('Scan a token'))
    assert.equal(s.length, 5)
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
