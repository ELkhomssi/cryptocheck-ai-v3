import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { explainFromGrounding } from '../../lib/intelligence-core/recommendation-grounding'
import { REPORT_MIN_EVENTS, NO_DIFF_EXPLANATION } from '../../types/intelligence-core'

describe('Phase 17.4 — RecommendationEngine grounding', () => {
  it('does NOT fabricate a reason when score changes without metric diffs', () => {
    const result = explainFromGrounding({
      metric: 'risk',
      before: null,
      after: null,
      scoreBefore: 40,
      scoreAfter: 16,
    })
    assert.equal(result.grounded, false)
    assert.equal(result.explanation, NO_DIFF_EXPLANATION)
    assert.doesNotMatch(result.explanation, /mint authority|liquidity|holder/i)
  })

  it('does NOT fabricate when before/after points exist but are identical', () => {
    const point = {
      mintAuthorityActive: false,
      freezeAuthorityActive: false,
      holderConcentrationPct: 12,
      liquidityUsd: 100_000,
      riskScore: 20,
    }
    const result = explainFromGrounding({
      metric: 'risk',
      before: point,
      after: { ...point },
      scoreBefore: 40,
      scoreAfter: 16,
    })
    assert.equal(result.grounded, false)
    assert.equal(result.explanation, NO_DIFF_EXPLANATION)
  })

  it('explains only from present underlying diffs when available', () => {
    const result = explainFromGrounding({
      metric: 'risk',
      before: {
        mintAuthorityActive: true,
        freezeAuthorityActive: true,
        holderConcentrationPct: 40,
        liquidityUsd: 50_000,
        riskScore: 70,
      },
      after: {
        mintAuthorityActive: false,
        freezeAuthorityActive: true,
        holderConcentrationPct: 40,
        liquidityUsd: 50_000,
        riskScore: 20,
      },
      scoreBefore: 70,
      scoreAfter: 16,
    })
    assert.equal(result.grounded, true)
    assert.match(result.explanation, /mint authority/)
    assert.match(result.explanation, /underlying risk/)
  })
})

describe('Phase 17.5 — ReportEngine thresholds', () => {
  it('defines honest minimum activity counts per report type', () => {
    assert.equal(REPORT_MIN_EVENTS.morning_brief, 3)
    assert.equal(REPORT_MIN_EVENTS.daily, 5)
    assert.equal(REPORT_MIN_EVENTS.weekly, 15)
    assert.equal(REPORT_MIN_EVENTS.monthly, 40)
  })
})
