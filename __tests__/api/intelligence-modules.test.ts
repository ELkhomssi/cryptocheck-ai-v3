import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  countActiveWorkersForModuleSync,
  INTELLIGENCE_MODULES,
  isWorkerActiveForModule,
  workerIdsForModule,
} from '../../lib/intelligence/modules'
import { computeOverallSystemHealth } from '../../lib/intelligence/score'
import { statusCopyForAgentRun } from '../../lib/intelligence/copy'
import { listBuiltinEmployees } from '../../lib/agents/roster'
import { INTEL_SCORE_THRESHOLDS } from '../../types/intelligence'

describe('Phase 16.1 — module ↔ worker mapping', () => {
  it('defines exactly 6 modules', () => {
    assert.equal(INTELLIGENCE_MODULES.length, 6)
  })

  it('every builtin employee has a modules array', () => {
    for (const emp of listBuiltinEmployees()) {
      assert.ok(Array.isArray(emp.modules), emp.id)
    }
  })

  it('scam-investigator contributes to security and launch', () => {
    const emp = listBuiltinEmployees().find((e) => e.id === 'scam-investigator')
    assert.ok(emp)
    assert.deepEqual(emp!.modules.slice().sort(), ['launch', 'security'])
  })

  it('worker counts come from roster queries, not literals in UI helpers', () => {
    const market = countActiveWorkersForModuleSync('market')
    assert.equal(market, workerIdsForModule('market').length)
    assert.ok(market >= 1)
    // Shared worker counted in both modules
    assert.ok(isWorkerActiveForModule('scam-investigator', 'security'))
    assert.ok(isWorkerActiveForModule('scam-investigator', 'launch'))
  })
})

describe('Phase 16.2 — score calibrating thresholds', () => {
  it('documents exact minimum thresholds', () => {
    assert.equal(INTEL_SCORE_THRESHOLDS.MIN_NON_CALIBRATING_WORKERS, 2)
    assert.equal(INTEL_SCORE_THRESHOLDS.MIN_UPTIME_PROBE_COUNT, 6)
    assert.equal(INTEL_SCORE_THRESHOLDS.MIN_UPTIME_HISTORY_MS, 24 * 60 * 60 * 1000)
    assert.equal(INTEL_SCORE_THRESHOLDS.MIN_SCORED_MODULES_FOR_OVERALL, 3)
    assert.equal(INTEL_SCORE_THRESHOLDS.WEIGHT_WORKER_PERF, 0.5)
    assert.equal(INTEL_SCORE_THRESHOLDS.WEIGHT_PROVIDER_UPTIME, 0.3)
    assert.equal(INTEL_SCORE_THRESHOLDS.WEIGHT_DATA_FRESHNESS, 0.2)
  })

  it('overall health is Calibrating with fewer than 3 real scores', () => {
    const early = computeOverallSystemHealth([
      { score: 80, calibrating: false },
      { score: 70, calibrating: false },
      { score: null, calibrating: true },
    ])
    assert.equal(early.calibrating, true)
    assert.equal(early.score, null)

    const ready = computeOverallSystemHealth([
      { score: 80, calibrating: false },
      { score: 70, calibrating: false },
      { score: 60, calibrating: false },
    ])
    assert.equal(ready.calibrating, false)
    assert.equal(ready.score, 70)
  })
})

describe('Phase 16.8 — Command Center module copy', () => {
  it('names the module, not the employee', () => {
    const copy = statusCopyForAgentRun('whale-analyst', 'running')
    assert.match(copy, /Market Intelligence/)
    assert.doesNotMatch(copy, /Whale/)
  })

  it('security worker routes to Security Intelligence copy', () => {
    const copy = statusCopyForAgentRun('scam-investigator', 'started')
    assert.match(copy, /Security Intelligence/)
    assert.doesNotMatch(copy, /Scam Investigator/)
  })
})
