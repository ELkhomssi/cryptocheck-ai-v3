import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  activeProofAt,
  buildDynamicSuggestions,
  buildMissionConversation,
  buildPortfolioNarrative,
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
  firstRun: false,
  userId: null,
  fetchedAt: new Date().toISOString(),
})

describe('Mission Control conversation', () => {
  it('opens as an already-running OS — never a reconstruct / boot sequence', () => {
    const loading = buildMissionConversation({
      displayName: 'Abderrahim',
      view: null,
      loading: true,
    })
    const speech = loading.turns.map((t) => t.text).join(' ')
    assert.match(loading.turns[0]!.text, /Good (morning|afternoon|evening) Abderrahim/)
    assert.match(speech, /While you were away, I continuously monitored/i)
    assert.doesNotMatch(speech, /Reconstruct|Initializing|Loading intelligence|Confirming|Reading\.\.\./i)
    assert.equal(loading.turns.every((t) => t.proof === 'none'), true)

    const ready = buildMissionConversation({
      displayName: 'Abderrahim',
      view: emptyView(),
      loading: false,
    })
    assert.doesNotMatch(
      ready.turns.map((t) => t.text).join(' '),
      /Reconstruct|operating picture|Initializing|Loading intelligence/i,
    )
  })

  it('speaks greeting → presence → attention, then highest-priority insight', () => {
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

    const conv = buildMissionConversation({
      displayName: 'Abderrahim',
      view: v,
      loading: false,
    })
    assert.match(conv.turns[0]!.text, /Good (morning|afternoon|evening) Abderrahim/)
    assert.match(conv.turns[1]!.text, /While you were away/i)
    assert.match(conv.turns[2]!.text, /I found \d+ items that deserve your attention today/i)
    assert.equal(conv.turns[3]!.text, 'Watch WIF liquidity thin-out')
    assert.doesNotMatch(conv.turns.map((t) => t.text).join(' '), /already been working for you/i)
    const propose = conv.turns.find((t) => t.kind === 'propose')
    assert.match(propose?.text ?? '', /Choose what we open next/i)
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
    v.recommendations = [
      {
        predictionId: 'p1',
        title: 'Market breadth improving',
        explanation: 'Sample supports constructive read.',
        grounded: true,
      },
    ]
    const conv = buildMissionConversation({ displayName: null, view: v, loading: false })
    const speech = conv.turns.map((t) => t.text).join(' ')
    assert.match(speech, /deserve your attention|Market breadth|strengthening/i)
    assert.doesNotMatch(speech, /\+3\.25%/)
    assert.doesNotMatch(speech, /\$50/)
    assert.equal(conv.riskSymbol, 'BONK')
    assert.ok(conv.marketMetrics.length > 0)
  })

  it('quiet day stays calm — monitoring, not reconstructing', () => {
    const conv = buildMissionConversation({
      displayName: null,
      view: emptyView(),
      loading: false,
    })
    const speech = conv.turns.map((t) => t.text).join(' ')
    assert.match(speech, /I’ve been monitoring the market, but nothing today requires immediate action/i)
    assert.doesNotMatch(speech, /Reconstruct|relatively quiet/i)
  })

  it('first-run onboarding is distinct from quiet day', () => {
    const v = emptyView()
    v.firstRun = true
    v.userId = 'user-a'
    const first = buildMissionConversation({ displayName: null, view: v, loading: false })
    const speech = first.turns.map((t) => t.text).join(' ')
    assert.match(speech, /don’t have history/i)
    assert.doesNotMatch(speech, /nothing today requires immediate action/i)
    assert.ok(first.preparedActions.some((a) => /scan a token|watchlist|wallet/i.test(a)))

    const quiet = emptyView()
    quiet.firstRun = false
    quiet.userId = 'user-a'
    const returning = buildMissionConversation({ displayName: null, view: quiet, loading: false })
    assert.match(
      returning.turns.map((t) => t.text).join(' '),
      /nothing today requires immediate action/i,
    )
    assert.doesNotMatch(returning.turns.map((t) => t.text).join(' '), /don’t have history/i)
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
