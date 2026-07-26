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
  it('speaks five beats — greeting, conclusion, why, action, ask', () => {
    const conv = buildMissionConversation({
      displayName: 'Abderrahim',
      view: emptyView(),
      loading: false,
    })
    const ids = conv.turns.map((t) => t.id)
    assert.deepEqual(ids, ['greet', 'conclusion', 'why', 'action', 'ask'])
    assert.match(conv.turns[0]!.text, /Good (morning|afternoon|evening) Abderrahim/)
    assert.equal(conv.turns.at(-1)?.text, 'What would you like me to do?')
    assert.match(conv.turns.find((t) => t.id === 'action')!.text, /Recommended action:/)
  })

  it('never puts metrics or invented whales in speech', () => {
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
    const speech = conv.turns.map((t) => t.text).join(' ')
    assert.match(speech, /aggressive/i)
    assert.match(speech, /filtered everything else/i)
    assert.doesNotMatch(speech, /\+3\.25%/)
    assert.doesNotMatch(speech, /\$50/)
    assert.doesNotMatch(speech, /whale accumulation increased/i)
    assert.ok(conv.marketMetrics.length > 0)
    assert.ok(conv.portfolioMetrics.length > 0)
  })

  it('keeps living activity out of first-screen turns', () => {
    const v = emptyView()
    v.running = [{ id: '1', description: 'Watching 214 whales', kind: 'watch' }]
    const conv = buildMissionConversation({ displayName: null, view: v, loading: false })
    assert.ok(conv.living.some((l) => /214 whales/i.test(l)))
    assert.ok(!conv.turns.some((t) => /214 whales/i.test(t.text)))
  })

  it('suggestions stay available below fold', () => {
    const v = emptyView()
    v.portfolio.connected = true
    v.portfolio.topWeightSymbol = 'BONK'
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

  it('maps running copy without inventing counts', () => {
    assert.equal(
      runningIntelligenceLabel('Market Intelligence is running your query', 'analysis'),
      'Scanning…',
    )
    assert.equal(
      runningIntelligenceLabel('Watching 214 whales across tracked wallets', 'watch'),
      'Watching 214 whales…',
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
