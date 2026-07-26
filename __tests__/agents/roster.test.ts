import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listBuiltinEmployees, getBuiltinEmployee, buildCustomSystemPrompt } from '../../lib/agents/roster'
import { parseStructuredAgentOutput } from '../../lib/agents/parse-structured'

describe('AI Employees roster', () => {
  it('defines all 9 built-in employees', () => {
    const list = listBuiltinEmployees()
    assert.equal(list.length, 9)
    assert.ok(list.every((e) => e.builtin))
    assert.deepEqual(
      list.map((e) => e.id).sort(),
      [
        'launch-advisor',
        'market-strategist',
        'news-intelligence',
        'portfolio-manager',
        'research-analyst',
        'risk-manager',
        'scam-investigator',
        'trading-coach',
        'whale-analyst',
      ].sort(),
    )
  })

  it('looks up employees by id', () => {
    assert.equal(getBuiltinEmployee('trading-coach')?.actionType, 'chat')
    assert.equal(getBuiltinEmployee('nope'), undefined)
  })

  it('builds locked custom prompt scaffold', () => {
    const p = buildCustomSystemPrompt('Scout', 'Watch liquidity.')
    assert.ok(p.includes('Scout'))
    assert.ok(p.includes('Watch liquidity.'))
    assert.ok(p.toLowerCase().includes('not financial advice'))
    assert.ok(p.includes('LIVE CONTEXT'))
  })
})

describe('parseStructuredAgentOutput', () => {
  it('parses fenced JSON', () => {
    const out = parseStructuredAgentOutput(
      '```json\n{"title":"T","summary":"S","disclaimer":"D","stats":[{"label":"A","value":"1"}]}\n```',
    )
    assert.equal(out.title, 'T')
    assert.equal(out.stats?.[0].value, '1')
  })

  it('falls back when not JSON', () => {
    const out = parseStructuredAgentOutput('plain text report')
    assert.ok(out.summary.includes('plain text'))
    assert.ok(out.disclaimer.toLowerCase().includes('not financial advice'))
  })
})

describe('performance calibrating rule', () => {
  it('requires snapshot + min samples before showing a score', () => {
    const emp = getBuiltinEmployee('trading-coach')!
    const min = emp.performanceFormula.minSamples
    const snap = { score: 88, sampleSize: 3, calibrating: false }
    const calibrating = snap.calibrating || snap.score == null || snap.sampleSize < min
    assert.equal(calibrating, true)

    const ready = { score: 72, sampleSize: min, calibrating: false }
    const show = !ready.calibrating && ready.score != null && ready.sampleSize >= min
    assert.equal(show, true)
  })
})
