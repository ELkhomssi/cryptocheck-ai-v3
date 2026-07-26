import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildDynamicSuggestions,
  buildMissionConversation,
  buildPortfolioNarrative,
  runningIntelligenceLabel,
} from '../../lib/portfolio-desk/mission-narrative'
import type { MissionViewModel } from '../../types/intelligence-core'

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
    assert.match(blob, /don’t have enough market activity/i)
    assert.doesNotMatch(blob, /whale accumulation increased/i)
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

  it('suggestions change with portfolio concentration', () => {
    const v = emptyView()
    v.portfolio.connected = true
    v.portfolio.topWeightSymbol = 'BONK'
    v.portfolio.dayChangePct = 1
    v.market.available = true
    v.market.aggregateChange24hPct = 3
    const s = buildDynamicSuggestions(v)
    assert.ok(s.some((x) => /BONK/i.test(x)))
    assert.ok(s.length <= 5)
  })

  it('portfolio narrative does not lead with balances', () => {
    const v = emptyView()
    v.portfolio.connected = true
    v.portfolio.totalValueUsd = 99999
    v.portfolio.dayChangePct = 1
    v.portfolio.topWeightSymbol = 'WIF'
    const n = buildPortfolioNarrative(v)
    assert.match(n.healthLine, /safely|operable|pressure|risk/i)
    assert.ok(n.weakness)
  })

  it('maps running copy without employee names', () => {
    assert.equal(
      runningIntelligenceLabel('Market Intelligence is running your query', 'analysis'),
      'Scanning…',
    )
  })
})
