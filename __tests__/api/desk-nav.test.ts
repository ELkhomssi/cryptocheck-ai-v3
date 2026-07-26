import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  marketTabFromLegacy,
  normalizeDeskNav,
  PRIMARY_NAV,
  PUBLIC_NAV,
} from '../../lib/portfolio-desk/nav'

describe('Phase 15 desk nav', () => {
  it('primary nav is exactly six workspaces', () => {
    assert.equal(PRIMARY_NAV.length, 6)
    assert.deepEqual(
      PRIMARY_NAV.map((i) => i.id),
      ['mission', 'market', 'trade', 'portfolio', 'launchlab', 'automation'],
    )
  })

  it('maps legacy routes without deleting reachability', () => {
    assert.equal(normalizeDeskNav('screener'), 'market')
    assert.equal(normalizeDeskNav('watchlist'), 'market')
    assert.equal(normalizeDeskNav('alerts'), 'feed')
    assert.equal(normalizeDeskNav('employees'), 'intelligence')
    assert.equal(normalizeDeskNav(null), 'mission')
    assert.equal(marketTabFromLegacy('watchlist'), 'tracked')
  })

  it('keeps market / feed public without wallet gate', () => {
    assert.equal(PUBLIC_NAV.has('market'), true)
    assert.equal(PUBLIC_NAV.has('feed'), true)
    assert.equal(PUBLIC_NAV.has('mission'), true)
  })
})
