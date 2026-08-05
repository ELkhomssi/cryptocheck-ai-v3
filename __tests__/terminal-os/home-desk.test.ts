/**
 * Mockup home desk composition is the default Terminal OS surface.
 * Run: node --import tsx --test __tests__/terminal-os/home-desk.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Terminal OS mockup home desk', () => {
  it('default shell mounts TerminalOsHomeDesk multi-panel composition', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    const desk = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsHomeDesk.tsx'),
      'utf8',
    )
    assert.match(shell, /TerminalOsHomeDesk/)
    assert.match(desk, /tos-home-desk/)
    assert.match(desk, /IntelligenceSwap/)
    assert.match(desk, /IntelligenceChart/)
    assert.match(desk, /DecisionBrainSpokes/)
    assert.match(desk, /LiveExecutionFeed/)
    assert.match(desk, /TradeLikeMeWidget/)
    assert.doesNotMatch(desk, /94%/)
    assert.doesNotMatch(desk, /37,?584/)
  })
})
