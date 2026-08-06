import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AUTOMATION_RECIPES,
  getAutomationRecipe,
} from '../../lib/portfolio-desk/automation-recipes'

const REAL_AGENT_IDS = new Set([
  'trading-coach',
  'research-analyst',
  'market-strategist',
  'whale-analyst',
  'risk-manager',
  'news-intelligence',
  'launch-advisor',
  'portfolio-manager',
  'scam-investigator',
])

describe('automation recipes', () => {
  it('maps every recipe to a real builtin agent id', () => {
    assert.equal(AUTOMATION_RECIPES.length, 4)
    for (const r of AUTOMATION_RECIPES) {
      assert.ok(REAL_AGENT_IDS.has(r.agentId), `${r.id} → ${r.agentId}`)
      assert.ok(r.intervalMinutes >= 60)
    }
  })

  it('resolves known recipes and rejects unknown', () => {
    assert.equal(getAutomationRecipe('whale-monitor')?.agentId, 'whale-analyst')
    assert.equal(getAutomationRecipe('portfolio-audit')?.agentId, 'risk-manager')
    assert.equal(getAutomationRecipe('nope'), undefined)
  })
})
