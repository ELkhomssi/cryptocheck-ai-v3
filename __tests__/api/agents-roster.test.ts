import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listBuiltinEmployees } from '../../lib/agents/roster'
import type { AgentPerformanceSnapshot, AIEmployee, RosterEmployeeView } from '../../types/agents'

function viewFor(
  emp: AIEmployee,
  snap: AgentPerformanceSnapshot | undefined,
): Pick<RosterEmployeeView, 'id' | 'performance'> {
  const min = emp.performanceFormula.minSamples
  const sampleSize = snap?.sampleSize ?? 0
  const calibrating = !snap || snap.calibrating || snap.score == null || sampleSize < min
  return {
    id: emp.id,
    performance: {
      score: calibrating ? null : snap!.score,
      sampleSize,
      calibrating,
      computedAt: snap?.computedAt ?? null,
    },
  }
}

describe('roster performance view rules', () => {
  it('never surfaces a % without a qualifying snapshot', () => {
    const employees = listBuiltinEmployees()
    for (const emp of employees) {
      const bare = viewFor(emp, undefined)
      assert.equal(bare.performance.calibrating, true)
      assert.equal(bare.performance.score, null)

      const early: AgentPerformanceSnapshot = {
        id: 'x',
        agentId: emp.id,
        score: 99,
        sampleSize: Math.max(0, emp.performanceFormula.minSamples - 1),
        calibrating: false,
        computedAt: new Date().toISOString(),
        meta: null,
      }
      const earlyView = viewFor(emp, early)
      assert.equal(earlyView.performance.calibrating, true)
      assert.equal(earlyView.performance.score, null)

      const ready: AgentPerformanceSnapshot = {
        id: 'y',
        agentId: emp.id,
        score: 64,
        sampleSize: emp.performanceFormula.minSamples,
        calibrating: false,
        computedAt: new Date().toISOString(),
        meta: null,
      }
      const readyView = viewFor(emp, ready)
      assert.equal(readyView.performance.calibrating, false)
      assert.equal(readyView.performance.score, 64)
    }
  })
})
