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
  it('speaks honest market gap — never invents aggression', () => {
    const conv = buildMissionConversation({
      displayName: 'Abderrahim',
      view: emptyView(),
      loading: false,
    })
    const blob = conv.turns.map((t) => t.text).join(' ')
    assert.match(blob, /don’t have enough information/i)
    assert.doesNotMatch(blob, /whale accumulation increased/i)
    assert.doesNotMatch(blob, /BTC\s*\+/i)
    assert.ok(conv.turns.some((t) => t.kind === 'ask'))
  })

  it('ends by asking what to do', () => {
    const conv = buildMissionConversation({
      displayName: null,
      view: emptyView(),
      loading: false,
    })
    const ask = conv.turns.find((t) => t.kind === 'ask')
    assert.equal(ask?.text, 'What would you like me to do?')
  })

  it('keeps numbers out of speech — evidence holds metrics', () => {
    const v = emptyView()
    v.market.available = true
    v.market.aggregateChange24hPct = 3.25
    v.market.topMoverSymbol = 'WIF'
    v.market.topMoverChange24hPct = 12
    v.portfolio.connected = true
    v.portfolio.totalValueUsd = 50000
    v.portfolio.dayChangePct = 0.5
    v.portfolio.topWeightSymbol = 'BONK'
    const conv = buildMissionConversation({ displayName: null, view: v, loading: false })
    const speech = conv.turns
      .filter((t) => t.kind === 'speech')
      .map((t) => t.text)
      .join(' ')
    assert.match(speech, /aggressive|buying pressure/i)
    assert.match(speech, /concentration in BONK/i)
    assert.doesNotMatch(speech, /\+3\.25%/)
    assert.doesNotMatch(speech, /\$50/)
    assert.ok(conv.evidence.length > 0)
    assert.ok(conv.metrics.some((m) => m.label === 'Sample 24h'))
  })

  it('suggestions change with portfolio concentration', () => {
    const v = emptyView()
    v.portfolio.connected = true
    v.portfolio.topWeightSymbol = 'BONK'
    v.portfolio.dayChangePct = 1
    v.market.available = true
    v.market.aggregateChange24hPct = 3
    const s = buildDynamicSuggestions(v)
    assert.ok(s.some((x) => /BONK/i.test(x)))
    assert.ok(s.length <= 4)
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

  it('maps running copy to living intelligence without inventing counts', () => {
    assert.equal(
      runningIntelligenceLabel('Market Intelligence is running your query', 'analysis'),
      'Scanning…',
    )
    assert.equal(
      runningIntelligenceLabel('Watching 214 whales across tracked wallets', 'watch'),
      'Watching 214 whales…',
    )
    assert.doesNotMatch(
      runningIntelligenceLabel('liquidity check in progress', 'scan'),
      /\d{2,}/,
    )
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
