import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildExecutiveBrief,
  buildMarketNarrative,
  buildMissionPriorities,
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
    body: 'Not enough activity yet to generate a morning brief.',
    insufficientActivity: true,
    pending: false,
    reportId: null,
  },
  fetchedAt: new Date().toISOString(),
})

describe('Phase 17.1 mission narratives', () => {
  it('explains market unavailability instead of inventing moves', () => {
    const n = buildMarketNarrative(emptyView())
    assert.ok(n.unavailableReason)
    assert.equal(n.paragraphs.length, 0)
    assert.match(n.unavailableReason!, /unavailable|empty|no rows/i)
  })

  it('does not invent portfolio risk without a wallet', () => {
    const n = buildPortfolioNarrative(emptyView())
    assert.equal(n.riskLabel, 'Unknown')
    assert.ok(n.unavailableReason)
  })

  it('executive brief stays honest when market glance is empty', () => {
    const brief = buildExecutiveBrief({
      displayName: null,
      view: emptyView(),
      loading: false,
    })
    assert.ok(brief.paragraphs.some((p) => /unavailable/i.test(p)))
    assert.ok(brief.dataGaps.length >= 1)
  })

  it('maps running copy without employee names', () => {
    assert.equal(
      runningIntelligenceLabel('Market Intelligence is running your query', 'analysis'),
      'Scanning…',
    )
    assert.match(
      runningIntelligenceLabel('Checking liquidity on mint', 'signals'),
      /liquidity/i,
    )
  })

  it('caps priorities at 3', () => {
    const v = emptyView()
    v.recommendations = [
      {
        title: 'A',
        explanation: 'x',
        grounded: true,
        predictionId: '1',
      },
      {
        title: 'B',
        explanation: 'y',
        grounded: true,
        predictionId: '2',
      },
      {
        title: 'C',
        explanation: 'z',
        grounded: true,
        predictionId: '3',
      },
    ]
    v.running = [{ id: 'r1', description: 'Scanning…', kind: 'report' }]
    v.dailyBrief.insufficientActivity = false
    v.dailyBrief.body = 'Ready'
    assert.equal(buildMissionPriorities(v).length, 3)
  })
})
