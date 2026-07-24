import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { preferenceUserId } from '../../lib/portfolio-desk/alert-preferences'

describe('alert preferences identity', () => {
  it('prefers session user id', () => {
    const id = preferenceUserId({
      sessionUserId: '11111111-2222-3333-4444-555555555555',
      wallet: 'So11111111111111111111111111111111111111112',
    })
    assert.equal(id, '11111111-2222-3333-4444-555555555555')
  })

  it('derives stable uuid from wallet', () => {
    const a = preferenceUserId({
      wallet: 'So11111111111111111111111111111111111111112',
    })
    const b = preferenceUserId({
      wallet: 'So11111111111111111111111111111111111111112',
    })
    assert.ok(a)
    assert.equal(a, b)
    assert.match(a!, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('returns null without session or wallet', () => {
    assert.equal(preferenceUserId({}), null)
  })
})
