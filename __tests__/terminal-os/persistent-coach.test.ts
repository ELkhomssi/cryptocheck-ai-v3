/**
 * Persistent Coach rail — Decision-backed bullets only.
 * Run: node --import tsx --test __tests__/terminal-os/persistent-coach.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Persistent Coach rail', () => {
  it('RightRail mounts PersistentCoachRail; bullets from Decision only', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    const coach = readFileSync(
      join(root, 'features/terminal-os/shell/components/PersistentCoachRail.tsx'),
      'utf8',
    )
    assert.match(shell, /PersistentCoachRail/)
    assert.match(shell, /data-tos-right="coach"/)
    assert.match(coach, /contributingFactors/)
    assert.match(coach, /No Decision published yet/)
    assert.match(coach, /CoachPanel/)
    assert.match(coach, /selectHeroDecision/)
    assert.doesNotMatch(coach, /SOL remains the #1/)
    assert.doesNotMatch(coach, /Reduced risk exposure by 18%/)
  })
})
