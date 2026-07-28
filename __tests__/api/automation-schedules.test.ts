import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AUTOMATION_RECIPES,
  getAutomationRecipe,
} from '../../lib/portfolio-desk/automation-recipes'

describe('automation schedules API contract', () => {
  it('exposes schedule intervals and agent bindings for API consumers', () => {
    for (const r of AUTOMATION_RECIPES) {
      const got = getAutomationRecipe(r.id)
      assert.ok(got)
      assert.equal(got!.agentId, r.agentId)
      assert.ok(got!.intervalMinutes >= 60)
      assert.ok(['report', 'signals', 'analysis', 'optimize', 'chat'].includes(got!.action))
    }
  })
})
