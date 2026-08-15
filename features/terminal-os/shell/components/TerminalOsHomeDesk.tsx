'use client'

/**
 * Mockup-wired TerminalOS home desk — visual from terminal_os_mockup.html,
 * every number from Decision / DNA / holdings / whales / tickMeta / fills.
 *
 * KERNEL CONNECTION DECLARATION
 * - Reads: published Decision (+ tickMeta), TraderDNA, holdings, attention/whales,
 *   captured-trades executedFills, /api/health (via rail badges)
 * - Emits: none new — Approve & Execute stays existing risk-gated IntelligenceSwap path
 * - Empty: honest unavailable / connect / scanning / training — never mockup placeholders
 *
 * Name map (mission → existing):
 * - AIGatewayHero → IntelligenceSwap / GatewayHeroFlow
 * - MissionControlRail → LeftRail (+ system status)
 * - SignalBreakdownPanel → DecisionBrainSpokes
 */

import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { IntelligenceChart } from '@/features/intelligence-chart'
import { PanelErrorBoundary } from '@/features/terminal-os/shared/components/PanelErrorBoundary'
import { PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { SOL_MINT } from '@/lib/portfolio-desk/constants'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import { summaryFromHoldings } from '@/features/terminal-os/portfolio-os/lib/summary-from-holdings'
import { AiCoachingCard } from '@/features/terminal-os/ai-coach/components/AiCoachingCard'
import { PortfolioAllocationDonut } from '@/features/terminal-os/portfolio-os/components/PortfolioAllocationDonut'
import {
  DecisionBrainSpokes,
  LiveExecutionFeed,
  AutonomousWorkflowStrip,
  ScannerDiscoveryStrip,
  TradeLikeMeDnaCard,
} from '@/features/terminal-os/shell/components/HomeDeskPanels'

const IntelligenceSwap = dynamic(
  () => import('@/features/ai-os/components/IntelligenceSwap').then((m) => m.IntelligenceSwap),
  { ssr: false, loading: () => <PanelSkeleton rows={8} /> },
)

function ChartIntelligencePanel() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)
  const query = focused?.id || focused?.symbol || SOL_MINT
  const chain = focused?.chain && focused.chain !== 'all' ? focused.chain : 'solana'
  const label = focused?.symbol ? `${focused.symbol}/USDC` : 'SOL/USDC'

  return (
    <section className="tos-desk-panel tos-desk-chart" data-tos-mockup-chart="true">
      <header className="tos-desk-panel-head">
        <span>
          <span className="mu-dot mu-dot-live" aria-hidden /> Chart Intelligence · {label}
        </span>
      </header>
      <PanelErrorBoundary title="Intelligence Chart">
        <IntelligenceChart
          query={query}
          chain={chain}
          onClose={focused ? () => setFocused(null) : undefined}
        />
      </PanelErrorBoundary>
    </section>
  )
}

/**
 * Kernel: /api/portfolio/holdings — real allocationPct / valueUsd only.
 * Empty: connect-wallet prompt — never a donut with fabricated slices.
 */
function PortfolioOverviewPanel() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const connected = useTerminalOsStore((s) => s.walletConnected)

  const q = useQuery({
    queryKey: ['tos', 'mockup-portfolio', wallet],
    enabled: Boolean(connected && wallet),
    queryFn: async (): Promise<HoldingsResponse> => {
      const res = await fetch(
        `/api/portfolio/holdings?wallet=${encodeURIComponent(wallet!)}`,
        { cache: 'no-store' },
      )
      if (!res.ok) throw new Error('holdings unavailable')
      return (await res.json()) as HoldingsResponse
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
    retry: 1,
  })

  const holdings = q.data?.holdings ?? []
  const total = q.data?.totalValueUsd ?? 0
  const summary = q.data ? summaryFromHoldings(q.data) : null
  const change = summary?.pnl24hPct
  const changeUsd = summary?.pnl24hUsd

  return (
    <section className="tos-desk-panel" data-tos-mockup-portfolio="true">
      <header className="tos-desk-panel-head">
        <span>Portfolio Overview</span>
      </header>
      {!connected || !wallet ? (
        <p className="tos-desk-empty">Connect a Solana wallet to load real holdings.</p>
      ) : q.isLoading ? (
        <PanelSkeleton rows={3} />
      ) : total <= 0 || holdings.length === 0 ? (
        <p className="tos-desk-empty">No holdings yet — donut hidden until real balances exist.</p>
      ) : (
        <>
          <div className="tos-mockup-portfolio-total tos-num">{formatUsd(total, true)}</div>
          {typeof change === 'number' && Number.isFinite(change) ? (
            <div
              className="tos-mockup-portfolio-chg"
              data-dir={change >= 0 ? 'up' : 'down'}
            >
              {typeof changeUsd === 'number' && Number.isFinite(changeUsd)
                ? `${changeUsd >= 0 ? '+' : ''}${formatUsd(Math.abs(changeUsd), true)} `
                : null}
              ({change >= 0 ? '+' : ''}
              {change.toFixed(2)}%) 24h
            </div>
          ) : (
            <div className="tos-desk-empty">24h change unavailable</div>
          )}
          <PortfolioAllocationDonut holdings={holdings} totalValueUsd={total} />
        </>
      )}
    </section>
  )
}

function CoachPanel() {
  return (
    <section className="tos-desk-panel" data-tos-mockup-coach="true">
      <header className="tos-desk-panel-head">
        <span>AI Coach · Master Advisor</span>
      </header>
      {/* Translator only — Decision.contributingFactors + coach API; never invents bullets */}
      <AiCoachingCard />
    </section>
  )
}

export function TerminalOsHomeDesk() {
  const focused = useTerminalOsStore((s) => s.focusedToken)

  return (
    <div
      className="tos-home-desk tos-mockup-desk"
      data-tos-home-desk="true"
      data-tos-mockup-desk="v1"
    >
      <div className="tos-mockup-center">
        <PanelErrorBoundary title="AI Gateway">
          <div className="tos-desk-panel tos-desk-gateway" data-tos-gateway="mockup">
            <IntelligenceSwap
              initialBuyMint={focused?.id ?? null}
              initialBuySymbol={focused?.symbol ?? null}
            />
          </div>
        </PanelErrorBoundary>

        <ChartIntelligencePanel />

        <PanelErrorBoundary title="Scanner & Discovery">
          <ScannerDiscoveryStrip />
        </PanelErrorBoundary>

        <PanelErrorBoundary title="Autonomous Workflow">
          <AutonomousWorkflowStrip />
        </PanelErrorBoundary>
      </div>
    </div>
  )
}

/** Right-rail intelligence stack for mockup home — real data panels only */
export function MockupIntelligenceRail() {
  return (
    <aside className="tos-right-rail tos-mockup-right" aria-label="Intelligence" data-tos-right="mockup">
      <PanelErrorBoundary title="Signal Breakdown">
        <DecisionBrainSpokes />
      </PanelErrorBoundary>
      <PanelErrorBoundary title="AI Coach">
        <CoachPanel />
      </PanelErrorBoundary>
      <PanelErrorBoundary title="Portfolio">
        <PortfolioOverviewPanel />
      </PanelErrorBoundary>
      <PanelErrorBoundary title="Trade Like Me DNA">
        <TradeLikeMeDnaCard />
      </PanelErrorBoundary>
      <PanelErrorBoundary title="Live Execution Feed">
        <LiveExecutionFeed />
      </PanelErrorBoundary>
    </aside>
  )
}
