/**
 * Command rail — classic Terminal + Trade Like Me moat.
 * Run: node --import tsx --test __tests__/terminal-os/left-rail.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Terminal OS command rail', () => {
  it('LeftRail uses classic Terminal hierarchy + TLM cards (no fabricated 12/12)', () => {
    const rail = readFileSync(
      join(root, 'features/terminal-os/shell/components/LeftRail.tsx'),
      'utf8',
    )
    const hooks = readFileSync(
      join(root, 'features/terminal-os/shell/hooks/useRailBadges.ts'),
      'utf8',
    )
    assert.match(rail, /Terminal/)
    assert.match(rail, /Mission Control/)
    assert.match(rail, /Whale Tracking/)
    assert.match(rail, /AiTradeLikeMeCard/)
    assert.match(rail, /useRailBadges/)
    assert.doesNotMatch(rail, /12\/12/)
    assert.match(hooks, /\/api\/health/)
    assert.match(hooks, /useWhaleMovements/)
    assert.match(hooks, /\/api\/terminal-os\/alerts/)
  })
})
