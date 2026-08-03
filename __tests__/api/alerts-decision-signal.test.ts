/**
 * ai_signal alerts evaluate against Decision confidence / action — not invented scores.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateCondition } from '../../lib/terminal-os/alert-evaluate'

describe('alert evaluateCondition Decision fields', () => {
  it('matches Decision.action equality', () => {
    assert.equal(
      evaluateCondition({ field: 'action', operator: '==', value: 'BUY' }, 'BUY'),
      true,
    )
    assert.equal(
      evaluateCondition({ field: 'action', operator: '==', value: 'BUY' }, 'WAIT'),
      false,
    )
  })

  it('matches Decision.confidence thresholds', () => {
    assert.equal(
      evaluateCondition({ field: 'confidence', operator: '>=', value: 70 }, 72),
      true,
    )
    assert.equal(
      evaluateCondition({ field: 'confidence', operator: '>=', value: 70 }, 55),
      false,
    )
  })
})
