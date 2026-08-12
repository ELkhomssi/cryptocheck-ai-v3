/**
 * Mission Control reference fidelity — chart/trade/format polish.
 * Run: node --import tsx --test __tests__/terminal-os/mc-fidelity.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'

const root = process.cwd()

describe('Mission Control reference fidelity', () => {
  it('formatUsd compact uses T/B/M/K (not million-only)', () => {
    assert.equal(formatUsd(2.2648392e12, true), '$2.26T')
    assert.equal(formatUsd(52.9064e9, true), '$52.91B')
    assert.equal(formatUsd(1.5e6, true), '$1.5M')
    assert.equal(formatUsd(2500, true), '$2.5K')
  })

  it('home chart defaults to SOL mint; assemble/resolve short-circuit SOL', () => {
    const desk = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsHomeDesk.tsx'),
      'utf8',
    )
    const live = readFileSync(join(root, 'lib/terminal-os/live-market.ts'), 'utf8')
    const assemble = readFileSync(
      join(root, 'features/intelligence-chart/engines/assemble-chart-bundle.ts'),
      'utf8',
    )
    assert.match(desk, /SOL_MINT/)
    assert.match(live, /Hard short-circuit majors/)
    assert.match(assemble, /So11111111111111111111111111111111111111112/)
    assert.match(live, /CHAIN_SEARCH_SEEDS/)
  })

  it('Quick Trade mission variant exposes You Pay / You Receive / Execute Trade', () => {
    const swap = readFileSync(
      join(root, 'features/terminal-os/trading-workspace/components/QuickSwapCard.tsx'),
      'utf8',
    )
    const builder = readFileSync(
      join(root, 'features/execution-desk/components/ExecutionBuilder.tsx'),
      'utf8',
    )
    const secure = readFileSync(
      join(root, 'features/execution-desk/components/SecureExecutionPanel.tsx'),
      'utf8',
    )
    assert.match(swap, /variant=\"mission\"|variant === 'mission'/)
    assert.match(builder, /You Pay \(USD\)/)
    assert.match(builder, /You Receive/)
    assert.match(secure, /ctaLabel/)
    assert.match(swap, /Execute Trade/)
  })

  it('coach recommendations + heatmap grid + gainers dedupe wired', () => {
    const mc = readFileSync(
      join(root, 'features/terminal-os/shell/components/MissionControlPanels.tsx'),
      'utf8',
    )
    const desk = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsHomeDesk.tsx'),
      'utf8',
    )
    const panels = readFileSync(
      join(root, 'features/terminal-os/shell/components/HomeDeskPanels.tsx'),
      'utf8',
    )
    assert.match(mc, /MissionCoachRecommendations/)
    assert.match(mc, /bySym|seenSym|Dedupe by symbol/)
    assert.match(desk, /MissionCoachRecommendations/)
    assert.match(panels, /tos-heatmap-grid|tos-heatmap-cell/)
    assert.doesNotMatch(mc, /18420/)
  })
})
