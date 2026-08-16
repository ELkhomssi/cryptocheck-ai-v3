/**
 * Command rail — Mission Control + real health badges.
 * Run: node --import tsx --test __tests__/terminal-os/left-rail.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Terminal OS command rail', () => {
  it('LeftRail uses Mission Control hierarchy + TLM cards (no fabricated 12/12)', () => {
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
    assert.match(rail, /AiTradeLikeMeCard/)
    assert.match(rail, /useRailBadges/)
    assert.match(rail, /tos-rail-system-status/)
    assert.doesNotMatch(rail, /12\/12/)
    assert.match(hooks, /\/api\/health/)
    assert.match(hooks, /useWhaleMovements/)
    assert.match(hooks, /\/api\/terminal-os\/alerts/)
  })
})
