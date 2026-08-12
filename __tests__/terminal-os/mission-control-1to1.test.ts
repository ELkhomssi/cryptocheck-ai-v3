/**
 * Mission Control 1:1 home desk — reference composition + honest kernels.
 * Run: node --import tsx --test __tests__/terminal-os/mission-control-1to1.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Mission Control 1:1 home', () => {
  it('home desk is 3-column Mission Control (not Gateway/Brain row desk)', () => {
    const desk = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsHomeDesk.tsx'),
      'utf8',
    )
    assert.match(desk, /tos-mc-grid/)
    assert.match(desk, /tos-mc-col-left/)
    assert.match(desk, /tos-mc-col-mid/)
    assert.match(desk, /tos-mc-col-right/)
    assert.match(desk, /MissionMetricsStrip/)
    assert.match(desk, /MissionMarketOverview/)
    assert.match(desk, /MissionTradeSuite/)
    assert.match(desk, /MissionAiSignals/)
    assert.match(desk, /MissionFooterStatus/)
    assert.match(desk, /IntelligenceChart/)
    assert.match(desk, /PersistentCoachRail/)
    assert.match(desk, /OnChainHeatmap/)
    assert.match(desk, /MissionAllocationPanel/)
    assert.match(desk, /MissionNewsAlerts/)
    assert.doesNotMatch(desk, /DecisionBrainSpokes/)
    assert.doesNotMatch(desk, /18,?420/)
    assert.doesNotMatch(desk, /94%/)
  })

  it('metrics / market / trade never hardcode mockup dollars or funding', () => {
    const panels = readFileSync(
      join(root, 'features/terminal-os/shell/components/MissionControlPanels.tsx'),
      'utf8',
    )
    assert.match(panels, /summaryFromHoldings/)
    assert.match(panels, /selectHeroDecision/)
    assert.match(panels, /fearGreed/)
    assert.match(panels, /Funding Rate[\s\S]*Unavailable/)
    assert.match(panels, /QuickSwapCard/)
    assert.doesNotMatch(panels, /18420|18,420/)
    assert.doesNotMatch(panels, /0\.010%/)
    assert.doesNotMatch(panels, /CryptoWhale/)
  })

  it('shell hides right rail + whale on Mission Control home; orange tokens present', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    const css = readFileSync(join(root, 'styles/terminal-os.css'), 'utf8')
    assert.match(shell, /data-tos-mc/)
    assert.match(shell, /if \(homeMode\) return null/)
    assert.match(css, /--tos-accent-orange:\s*#f97316/)
    assert.match(css, /tos-mc-grid/)
    assert.match(css, /tos-mc-footer/)
  })

  it('left rail matches reference Mission Control hierarchy', () => {
    const rail = readFileSync(
      join(root, 'features/terminal-os/shell/components/LeftRail.tsx'),
      'utf8',
    )
    assert.match(rail, /Mission Control/)
    assert.match(rail, /Trade Like Me/)
    assert.match(rail, /AI Coaching/)
    assert.match(rail, /Chart Analysis/)
    assert.match(rail, /Wallet Intelligence/)
    assert.match(rail, /Risk Engine/)
    assert.match(rail, /AI Signals/)
    assert.match(rail, /Rug Forensics/)
    assert.match(rail, /Upgrade Plan/)
    assert.match(rail, /All Systems Operational/)
    assert.doesNotMatch(rail, /AI Gateway/)
    assert.doesNotMatch(rail, /12\/12/)
  })
})
