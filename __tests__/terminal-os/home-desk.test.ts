/**
 * TerminalOS mockup → real data wiring.
 * Run: node --import tsx --test __tests__/terminal-os/home-desk.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { allocationSegments } from '@/features/terminal-os/portfolio-os/lib/allocation-segments'
import { summaryFromHoldings } from '@/features/terminal-os/portfolio-os/lib/summary-from-holdings'

const root = process.cwd()

describe('Terminal OS mockup home desk', () => {
  it('layout extracts mockup tokens and mounts data-tos-mockup', () => {
    const layout = readFileSync(join(root, 'app/terminalOS/layout.tsx'), 'utf8')
    const tokens = readFileSync(join(root, 'styles/terminal-os-mockup.css'), 'utf8')
    assert.match(layout, /terminal-os-mockup\.css/)
    assert.match(layout, /data-tos-mockup=["']v1["']/)
    assert.match(tokens, /--bg-void:\s*#05070d/)
    assert.match(tokens, /--teal:\s*#2dd4bf/)
    assert.match(tokens, /--amber:\s*#fbbf24/)
    assert.match(tokens, /\.mu-glass|backdrop-filter:\s*blur\(24px\)/)
  })

  it('default shell mounts mockup desk: gateway + chart + scanner + workflow', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    const desk = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsHomeDesk.tsx'),
      'utf8',
    )
    assert.match(shell, /TerminalOsHomeDesk/)
    assert.match(shell, /MockupIntelligenceRail/)
    assert.match(shell, /data-tos-mockup=["']v1["']/)
    assert.match(desk, /tos-mockup-desk/)
    assert.match(desk, /IntelligenceSwap/)
    assert.match(desk, /IntelligenceChart/)
    assert.match(desk, /ScannerDiscoveryStrip/)
    assert.match(desk, /AutonomousWorkflowStrip/)
    assert.match(desk, /DecisionBrainSpokes/)
    assert.match(desk, /TradeLikeMeDnaCard/)
    assert.match(desk, /LiveExecutionFeed/)
    assert.match(desk, /summaryFromHoldings/)
    assert.doesNotMatch(desk, /94%/)
    assert.doesNotMatch(desk, /37,?584/)
    assert.doesNotMatch(desk, /87%/)
  })

  it('shell home mode keeps classic whale chrome; lifecycle hidden via mockup CSS', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    const tokens = readFileSync(join(root, 'styles/terminal-os-mockup.css'), 'utf8')
    assert.match(shell, /data-tos-home/)
    assert.match(shell, /homeMode/)
    assert.match(shell, /WhaleMarqueeTicker/)
    assert.match(shell, /MoneyLifecycleRibbon/)
    assert.match(tokens, /\.tos-lifecycle-slot\s*\{\s*display:\s*none/)
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
    assert.match(panels, /No activity yet|No open positions|Scanning — no ranked opportunities yet/)
    assert.match(panels, /executedFills/)
    assert.doesNotMatch(panels, /Executed <strong>\{meta\.buyCount\}/)
    assert.match(panels, /Sample DNA is not shown as live/)
  })

  it('LeftRail System Status uses real health ok/total — never hardcodes 12/12', () => {
    const rail = readFileSync(
      join(root, 'features/terminal-os/shell/components/LeftRail.tsx'),
      'utf8',
    )
    const hooks = readFileSync(
      join(root, 'features/terminal-os/shell/hooks/useRailBadges.ts'),
      'utf8',
    )
    assert.match(rail, /MISSION CONTROL/)
    assert.match(rail, /tos-rail-system-status/)
    assert.match(rail, /ok\}\/\{total\} engines live/)
    assert.doesNotMatch(rail, /12\/12/)
    assert.doesNotMatch(rail, /100%/)
    assert.match(hooks, /\/api\/health/)
    assert.match(hooks, /entries\.length/)
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
    assert.match(rail, /Mission Control/)
    assert.match(rail, /AI Gateway|Chart Intelligence/)
    assert.match(rail, /AiTradeLikeMeCard/)
  })

  it('topbar portfolio value reads holdings not mockup dollars', () => {
    const top = readFileSync(
      join(root, 'features/terminal-os/shell/components/TopBar.tsx'),
      'utf8',
    )
    assert.match(top, /TERMINAL OS/)
    assert.match(top, /\/api\/portfolio\/holdings/)
    assert.doesNotMatch(top, /37584/)
  })

  it('captured-trades GET exposes executedFills for workflow strip', () => {
    const route = readFileSync(join(root, 'app/api/terminal-os/captured-trades/route.ts'), 'utf8')
    assert.match(route, /export async function GET/)
    assert.match(route, /executedFills/)
    assert.match(route, /wasRejectedOpportunity/)
  })

  it('coach empty copy matches mission honest empty', () => {
    const coach = readFileSync(
      join(root, 'features/terminal-os/ai-coach/components/AiCoachingCard.tsx'),
      'utf8',
    )
    assert.match(coach, /Not enough activity yet to advise on/)
    assert.match(coach, /contributingFactors/)
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

  it('summaryFromHoldings derives weighted 24h from holdings (never mock dollars)', () => {
    const s = summaryFromHoldings({
      walletAddress: 'x',
      totalValueUsd: 1000,
      availableSol: 0,
      availableSolUsd: 0,
      fetchedAt: new Date().toISOString(),
      holdings: [
        {
          mint: 'a',
          symbol: 'SOL',
          name: 'Solana',
          logoUrl: null,
          amount: 1,
          valueUsd: 500,
          priceUsd: 100,
          change24hPct: 4,
          avgBuyPriceUsd: null,
          allocationPct: 50,
          decimals: 9,
        },
        {
          mint: 'b',
          symbol: 'USDC',
          name: 'USD Coin',
          logoUrl: null,
          amount: 500,
          valueUsd: 500,
          priceUsd: 1,
          change24hPct: 0,
          avgBuyPriceUsd: null,
          allocationPct: 50,
          decimals: 6,
        },
      ],
    })
    assert.equal(s.pnl24hPct, 2)
    assert.equal(s.totalAssetsUsd, 1000)
  })
})
