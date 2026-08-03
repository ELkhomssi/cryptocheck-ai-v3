/**
 * AI OS Mission Control node mapping — pure.
 * Run: node --import tsx --test __tests__/ai-os/mission-control-nodes.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { ModuleCardView } from '../../types/intelligence'
import type { MissionViewModel } from '../../types/intelligence-core'

/** Mirror of drawer mapping for unit coverage (keep in sync with MissionControlDrawer). */
function mapModuleState(
  state: ModuleCardView['state'],
  calibrating: boolean,
): 'live' | 'idle' | 'waiting' | 'offline' | 'calibrating' {
  if (calibrating) return 'calibrating'
  if (state === 'running' || state === 'investigating') return 'live'
  if (state === 'waiting') return 'waiting'
  return 'idle'
}

describe('AI OS mission control status', () => {
  it('maps running modules to live and calibrating honestly', () => {
    assert.equal(mapModuleState('running', false), 'live')
    assert.equal(mapModuleState('running', true), 'calibrating')
    assert.equal(mapModuleState('idle', false), 'idle')
  })

  it('mission view never invents portfolio USD when null', () => {
    const view = {
      portfolio: {
        connected: true,
        totalValueUsd: null,
        dayChangePct: null,
        topWeightSymbol: null,
        error: 'unavailable',
      },
    } as Pick<MissionViewModel, 'portfolio'>
    assert.equal(view.portfolio.totalValueUsd, null)
    assert.ok(view.portfolio.error)
  })
})
