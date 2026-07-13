import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  SPIN_COOLDOWN_MS,
  canSpinAgain,
  msUntilNextSpin,
  nextSpinAt,
  pickSpinPrize,
  prizeIndex,
  SPIN_PRIZES,
} from '../../lib/dashboard/spin-wheel'

describe('spin-wheel helpers', () => {
  it('allows spin when never spun', () => {
    assert.equal(canSpinAgain(null), true)
    assert.equal(canSpinAgain(undefined), true)
  })

  it('blocks spin within 24h', () => {
    const now = Date.parse('2026-07-13T12:00:00.000Z')
    const last = new Date(now - 60 * 60 * 1000).toISOString()
    assert.equal(canSpinAgain(last, now), false)
    assert.ok(msUntilNextSpin(last, now) > 0)
    assert.equal(nextSpinAt(last), new Date(Date.parse(last) + SPIN_COOLDOWN_MS).toISOString())
  })

  it('allows spin after 24h', () => {
    const now = Date.parse('2026-07-13T12:00:00.000Z')
    const last = new Date(now - SPIN_COOLDOWN_MS - 1).toISOString()
    assert.equal(canSpinAgain(last, now), true)
    assert.equal(msUntilNextSpin(last, now), 0)
  })

  it('picks a valid prize', () => {
    const p = pickSpinPrize(0)
    assert.ok(SPIN_PRIZES.some((x) => x.id === p.id))
    assert.equal(prizeIndex(p.id) >= 0, true)
  })
})
