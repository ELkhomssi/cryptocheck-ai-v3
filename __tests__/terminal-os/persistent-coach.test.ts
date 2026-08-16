/**
 * Coach on mockup home rail — Decision-backed bullets only (translator, never inventor).
 * Run: node --import tsx --test __tests__/terminal-os/persistent-coach.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Persistent Coach rail', () => {
  it('Mockup home rail mounts AiCoachingCard; bullets from Decision only', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    const desk = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsHomeDesk.tsx'),
      'utf8',
    )
    const coach = readFileSync(
      join(root, 'features/terminal-os/ai-coach/components/AiCoachingCard.tsx'),
      'utf8',
    )
    const persistent = readFileSync(
      join(root, 'features/terminal-os/shell/components/PersistentCoachRail.tsx'),
      'utf8',
    )
    assert.match(shell, /MockupIntelligenceRail/)
    assert.match(desk, /AiCoachingCard/)
    assert.match(desk, /data-tos-mockup-coach/)
    assert.match(coach, /contributingFactors/)
    assert.match(coach, /Not enough activity yet to advise on/)
    assert.match(coach, /selectHeroDecision/)
    assert.doesNotMatch(coach, /SOL remains the #1/)
    assert.doesNotMatch(coach, /Reduced risk exposure by 18%/)
    // PersistentCoachRail retained for workspace reuse; Decision-only contract intact
    assert.match(persistent, /contributingFactors/)
    assert.match(persistent, /No Decision published yet/)
  })
})
