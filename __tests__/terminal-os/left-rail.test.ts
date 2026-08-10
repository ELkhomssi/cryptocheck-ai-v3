/**
 * Command rail badges — honest empty-state rules.
 * Run: node --import tsx --test __tests__/terminal-os/left-rail.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Terminal OS command rail', () => {
  it('LeftRail uses mockup hierarchy + real badge hooks (no fabricated 12/12)', () => {
    const rail = readFileSync(
      join(root, 'features/terminal-os/shell/components/LeftRail.tsx'),
      'utf8',
    )
    const hooks = readFileSync(
      join(root, 'features/terminal-os/shell/hooks/useRailBadges.ts'),
      'utf8',
    )
    assert.match(rail, /AI Gateway/)
    assert.match(rail, /Mission Control/)
    assert.match(rail, /Whale Command/)
    assert.match(rail, /Trade Like Me/)
    assert.match(rail, /Automation Hub/)
    assert.match(rail, /useRailBadges/)
    assert.match(rail, /tos-nav-gauge/)
    assert.doesNotMatch(rail, /12\/12/)
    assert.doesNotMatch(rail, /100%/)
    assert.match(hooks, /\/api\/health/)
    assert.match(hooks, /useWhaleMovements/)
    assert.match(hooks, /\/api\/terminal-os\/alerts/)
    assert.match(hooks, /Degraded/)
    assert.match(hooks, /ALL SYSTEMS ONLINE/)
  })
})
