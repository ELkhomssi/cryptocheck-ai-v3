import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  clusterEvents,
  eventsForTimeline,
  markerOpacityForLayerCount,
} from '../../features/intelligence-chart/composition'
import { getStateAtTimestamp } from '../../features/intelligence-chart/lib/get-state-at-timestamp'
import type { ChartEvent, IntelligenceSidebarState } from '../../features/intelligence-chart/types'

function ev(partial: Partial<ChartEvent> & Pick<ChartEvent, 'id' | 'timestamp' | 'layerId'>): ChartEvent {
  return {
    price: 1,
    severity: 'info',
    label: 'test',
    detail: 'detail',
    sourceEngineRef: 'engine:test',
    ...partial,
  }
}

describe('intelligence-chart composition', () => {
  it('clusters events within ~4px screen space', () => {
    const events = [
      ev({ id: 'a', timestamp: 1, layerId: 'liquidity', severity: 'info' }),
      ev({ id: 'b', timestamp: 1, layerId: 'security', severity: 'critical' }),
      ev({ id: 'c', timestamp: 1, layerId: 'developer', severity: 'notable' }),
      ev({ id: 'd', timestamp: 99, layerId: 'liquidity', severity: 'info' }),
    ]
    const clusters = clusterEvents(events, (e) => {
      if (e.id === 'd') return { xPx: 100, yPx: 100 }
      return { xPx: 10, yPx: 10 }
    })
    assert.equal(clusters.length, 2)
    const stacked = clusters.find((c) => c.count === 3)
    assert.ok(stacked)
    assert.equal(stacked!.severity, 'critical')
    assert.equal(stacked!.primaryLayer, 'security')
  })

  it('keeps critical/security markers at full opacity', () => {
    assert.equal(markerOpacityForLayerCount(5, 'critical', 'liquidity'), 1)
    assert.equal(markerOpacityForLayerCount(5, 'info', 'security'), 1)
    assert.ok(markerOpacityForLayerCount(5, 'info', 'liquidity') < 1)
  })

  it('timeline respects layer toggles', () => {
    const events = [
      ev({ id: '1', timestamp: 1, layerId: 'liquidity' }),
      ev({ id: '2', timestamp: 2, layerId: 'ai' }),
      ev({ id: '3', timestamp: 3, layerId: 'narrative' }),
    ]
    const visible = eventsForTimeline(events, { liquidity: true, ai: false, narrative: true })
    assert.deepEqual(
      visible.map((e) => e.id),
      ['1', '3'],
    )
  })
})

describe('getStateAtTimestamp', () => {
  it('returns latest sample at or before ts — never invents midpoints', () => {
    const timeline: IntelligenceSidebarState[] = [
      {
        timestamp: 100,
        aiConviction: 40,
        risk: 20,
        confidence: 50,
        narrative: 'a',
        trend: 50,
        smartMoneyActivity: 10,
        whalePressure: 'neutral',
        holderHealth: null,
        sourceRefs: ['a'],
      },
      {
        timestamp: 200,
        aiConviction: 80,
        risk: 30,
        confidence: 70,
        narrative: 'b',
        trend: 60,
        smartMoneyActivity: 20,
        whalePressure: 'accumulating',
        holderHealth: null,
        sourceRefs: ['b'],
      },
    ]
    assert.equal(getStateAtTimestamp(timeline, 150)?.narrative, 'a')
    assert.equal(getStateAtTimestamp(timeline, 200)?.narrative, 'b')
    assert.equal(getStateAtTimestamp([], 1), null)
  })
})
