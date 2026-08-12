/**
 * Mission Control remains reachable as a workspace (not default home).
 * Run: node --import tsx --test __tests__/terminal-os/mission-control-1to1.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Mission Control workspace (not default home)', () => {
  it('shell keeps Mission Control workspace route; home is classic PRO desk', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    const desk = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsHomeDesk.tsx'),
      'utf8',
    )
    const rail = readFileSync(
      join(root, 'features/terminal-os/shell/components/LeftRail.tsx'),
      'utf8',
    )
    assert.match(shell, /MissionControlWorkspace/)
    assert.match(rail, /Mission Control/)
    assert.match(desk, /tos-classic-desk|data-tos-classic/)
    assert.doesNotMatch(desk, /tos-mc-grid/)
  })

  it('MissionControlPanels still honest (no mock funding / dollars)', () => {
    const panels = readFileSync(
      join(root, 'features/terminal-os/shell/components/MissionControlPanels.tsx'),
      'utf8',
    )
    assert.match(panels, /summaryFromHoldings/)
    assert.match(panels, /selectHeroDecision/)
    assert.match(panels, /Funding Rate[\s\S]*Unavailable/)
    assert.doesNotMatch(panels, /18420|18,420/)
    assert.doesNotMatch(panels, /0\.010%/)
  })

  it('classic shell restores whale + right rail (overrides MC full-bleed home)', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    const css = readFileSync(join(root, 'styles/terminal-os.css'), 'utf8')
    assert.match(shell, /data-tos-classic/)
    assert.match(shell, /WhaleMarqueeTicker/)
    assert.match(css, /--tos-accent-gold:\s*#d4af37/)
    assert.match(css, /--tos-bg-app:\s*#050505/)
    assert.doesNotMatch(css, /--tos-accent-cyan:\s*#00e0ff/)
    assert.doesNotMatch(css, /--tos-bg-app:\s*#0a0e14/)
  })

  it('left rail includes Mission Control in classic hierarchy', () => {
    const rail = readFileSync(
      join(root, 'features/terminal-os/shell/components/LeftRail.tsx'),
      'utf8',
    )
    assert.match(rail, /Mission Control/)
    assert.match(rail, /Trade Like Me|AiTradeLikeMeCard/)
    assert.match(rail, /TERMINAL/)
  })
})
