/**
 * Mission Control home desk composition — 1:1 reference panels, kernel-backed.
 * Run: node --import tsx --test __tests__/terminal-os/home-desk.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { allocationSegments } from '@/features/terminal-os/portfolio-os/lib/allocation-segments'

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
    assert.match(desk, /tos-mc-grid/)
    assert.match(desk, /MissionTradeSuite|QuickSwapCard/)
    assert.match(desk, /IntelligenceChart/)
    assert.match(desk, /MissionMetricsStrip/)
    assert.match(desk, /OnChainHeatmap/)
    assert.match(desk, /PositionsSnapshot/)
    assert.match(desk, /MissionFooterStatus/)
    assert.doesNotMatch(desk, /94%/)
    assert.doesNotMatch(desk, /37,?584/)
    assert.doesNotMatch(desk, /87% DNA/)
  })

  it('shell home mode hides lifecycle density strip', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    assert.match(shell, /data-tos-home/)
    assert.match(shell, /homeMode/)
  })

  it('brain map helpers remain Decision-factor based (no placeholder scores)', () => {
    const panels = readFileSync(
      join(root, 'features/terminal-os/shell/components/HomeDeskPanels.tsx'),
      'utf8',
    )
    assert.match(panels, /tos-brain-orbit/)
    assert.match(panels, /contributingFactors/)
    assert.doesNotMatch(panels, /Market Sentiment \(92%\)/)
  })

  it('home desk panels declare honest empty states and kernel sources', () => {
    const panels = readFileSync(
      join(root, 'features/terminal-os/shell/components/HomeDeskPanels.tsx'),
      'utf8',
    )
    const mc = readFileSync(
      join(root, 'features/terminal-os/shell/components/MissionControlPanels.tsx'),
      'utf8',
    )
    assert.match(panels, /No activity yet|No open positions|Scanning — no ranked opportunities yet/)
    assert.match(panels, /executedFills/)
    assert.match(mc, /Not enough data yet|Unavailable|Connect wallet/)
    assert.match(mc, /KERNEL|summaryFromHoldings|selectHeroDecision/)
    assert.doesNotMatch(mc, /87%\s*DNA/)
    assert.doesNotMatch(panels, /Executed <strong>\{meta\.buyCount\}/)
  })

  it('shell wires reference nav destinations', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    const rail = readFileSync(
      join(root, 'features/terminal-os/shell/components/LeftRail.tsx'),
      'utf8',
    )
    assert.match(shell, /chart-intelligence/)
    assert.match(shell, /backtesting/)
    assert.match(rail, /Backtesting/)
    assert.match(rail, /Mission Control/)
    assert.match(rail, /Chart Analysis/)
  })

  it('topbar portfolio value reads holdings not mockup dollars', () => {
    const top = readFileSync(
      join(root, 'features/terminal-os/shell/components/TopBar.tsx'),
      'utf8',
    )
    assert.match(top, /TERMINAL OS/)
    assert.match(top, /\/api\/portfolio\/holdings/)
    assert.match(top, /TOTAL MKT CAP|useMarketOverview/)
    assert.doesNotMatch(top, /37584/)
  })

  it('captured-trades GET exposes executedFills for workflow strip', () => {
    const route = readFileSync(join(root, 'app/api/terminal-os/captured-trades/route.ts'), 'utf8')
    assert.match(route, /export async function GET/)
    assert.match(route, /executedFills/)
    assert.match(route, /wasRejectedOpportunity/)
  })

  it('allocationSegments uses real allocationPct only', () => {
    const segs = allocationSegments([
      { mint: 'a', symbol: 'SOL', allocationPct: 48.2, valueUsd: 4820 },
      { mint: 'b', symbol: 'USDC', allocationPct: 22.1, valueUsd: 2210 },
      { mint: 'c', symbol: 'JUP', allocationPct: 29.7, valueUsd: 2970 },
    ])
    assert.equal(segs.length, 3)
    assert.equal(segs[0]!.symbol, 'SOL')
    assert.ok(Math.abs(segs.reduce((s, x) => s + x.pct, 0) - 100) < 0.2)
    assert.deepEqual(allocationSegments([]), [])
  })
})
