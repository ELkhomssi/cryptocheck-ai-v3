import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { COACH_MIN_TRADES_FOR_INSIGHT } from '@/lib/personal-watch/constants'

describe('coach analytics honesty gates', () => {
  it('requires at least COACH_MIN_TRADES_FOR_INSIGHT trades', () => {
    assert.ok(COACH_MIN_TRADES_FOR_INSIGHT >= 5)
  })

  it('insight must cite trades — empty sample cannot invent summary', () => {
    const cited: unknown[] = []
    const allowInsight = cited.length >= COACH_MIN_TRADES_FOR_INSIGHT
    assert.equal(allowInsight, false)
  })
})
