import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildDynamicSuggestions,
  buildMissionOsSummary,
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
  firstRun: false,
  userId: null,
  fetchedAt: new Date().toISOString(),
})

describe('Mission Control OS summary', () => {
  it('never emits chat / reconstruct / offline theatre copy', () => {
    const os = buildMissionOsSummary(emptyView())
    const blob = JSON.stringify(os)
    assert.doesNotMatch(
      blob,
      /While you were away|I continuously monitored|I’m offline|OPENAI|Reconstruct|Message Mission Control|Choose what we open next/i,
    )
  })

  it('surfaces grounded priorities from the Recommendation Engine', () => {
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
    v.recommendations = [
      {
        predictionId: 'p1',
        title: 'Watch WIF liquidity thin-out',
        explanation: 'Grounded from live sample.',
        grounded: true,
      },
      {
        predictionId: 'p2',
        title: 'Trim BONK concentration',
        explanation: 'Concentration risk.',
        grounded: true,
      },
    ]
    const os = buildMissionOsSummary(v)
    assert.equal(os.priorities[0]!.title, 'Watch WIF liquidity thin-out')
    assert.equal(os.priorities[0]!.level, 'High')
    assert.match(os.statusLine, /2 grounded priorities/i)
    assert.match(os.marketHeadline, /constructive|defensive|orderly/i)
    assert.doesNotMatch(JSON.stringify(os.marketMetrics), /While you were away/)
    assert.ok(os.marketMetrics.some((m) => m.label === 'Sample 24h'))
    assert.equal(os.riskSymbol, 'BONK')
  })

  it('keeps quiet / empty engines honest without chat voice', () => {
    const os = buildMissionOsSummary(emptyView())
    assert.match(os.statusLine, /No grounded priorities/i)
    assert.match(os.briefBody, /Insufficient timeline activity/i)
    assert.equal(os.automationLines.length, 0)
  })

  it('first-run is distinct from quiet day', () => {
    const v = emptyView()
    v.firstRun = true
    const first = buildMissionOsSummary(v)
    assert.match(first.statusLine, /First session/i)

    const quiet = buildMissionOsSummary(emptyView())
    assert.doesNotMatch(quiet.statusLine, /First session/i)
    assert.match(quiet.statusLine, /No grounded priorities/i)
  })

  it('automation lines use system voice — not first-person chat', () => {
    assert.match(
      runningIntelligenceLabel('liquidity scan across pools', 'scan'),
      /Liquidity analysis running/i,
    )
    assert.doesNotMatch(
      runningIntelligenceLabel('liquidity scan across pools', 'scan'),
      /\bI’m\b|\bI am\b/i,
    )
  })

  it('prepared actions stay institutional for deep-links', () => {
    const v = emptyView()
    v.portfolio.connected = true
    v.portfolio.topWeightSymbol = 'BONK'
    const s = buildDynamicSuggestions(v)
    assert.equal(s[0], 'Show hidden risks')
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
