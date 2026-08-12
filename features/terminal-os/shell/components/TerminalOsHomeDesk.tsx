'use client'

/**
 * Terminal OS home — mockup multi-panel desk composition.
 * Reuses Gateway / Chart / Portfolio / TLM engines; presentation layout only.
 */

import dynamic from 'next/dynamic'
import { IntelligenceChart } from '@/features/intelligence-chart'
import { PortfolioOverviewPanel } from '@/features/terminal-os/portfolio-os/components/PortfolioOverviewPanel'
import { PanelErrorBoundary } from '@/features/terminal-os/shared/components/PanelErrorBoundary'
import { PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'
import {
  AutonomousWorkflowStrip,
  CurrentMissionsPanel,
  DecisionBrainSpokes,
  LiveExecutionFeed,
  PositionsSnapshot,
  ScannerDiscoveryStrip,
} from '@/features/terminal-os/shell/components/HomeDeskPanels'

const IntelligenceSwap = dynamic(
  () => import('@/features/ai-os/components/IntelligenceSwap').then((m) => m.IntelligenceSwap),
  { ssr: false, loading: () => <PanelSkeleton rows={8} /> },
)

const TradeLikeMeWidget = dynamic(
  () =>
    import('@/features/terminal-os/ai-trade-like-me/components/TradeLikeMeWidget').then(
      (m) => m.TradeLikeMeWidget,
    ),
  { ssr: false, loading: () => <PanelSkeleton rows={4} /> },
)

function ChartSurface() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)
  const query = focused?.id || focused?.symbol || 'SOL'
  const chain = focused?.chain || 'solana'
  return (
    <PanelErrorBoundary title="Chart Intelligence">
      <div className="tos-desk-panel tos-desk-chart" data-tos-chart="true">
        <header className="tos-desk-panel-head">
          <span>Chart Intelligence</span>
          <span className="tos-desk-live" data-on="true">
            {focused?.symbol ?? 'SOL'}
          </span>
        </header>
        <IntelligenceChart
          query={query}
          chain={chain}
          onClose={focused ? () => setFocused(null) : undefined}
        />
      </div>
    </PanelErrorBoundary>
  )
}

export function TerminalOsHomeDesk() {
  const focused = useTerminalOsStore((s) => s.focusedToken)

  return (
    <div className="tos-home-desk" data-tos-home-desk="true">
      <section className="tos-home-row tos-home-row-top" aria-label="Decision row">
        <PanelErrorBoundary title="AI Gateway">
          <div className="tos-desk-panel tos-desk-gateway" data-tos-gateway="true">
            <header className="tos-desk-panel-head">
              <span>AI Gateway — The Brain</span>
              <span className="tos-desk-live" data-on="true">
                Primary
              </span>
            </header>
            <IntelligenceSwap
              initialBuyMint={focused?.id ?? null}
              initialBuySymbol={focused?.symbol ?? null}
            />
          </div>
        </PanelErrorBoundary>

        <DecisionBrainSpokes />
        <CurrentMissionsPanel />
      </section>

      <section className="tos-home-row tos-home-row-mid" aria-label="Market row">
        <ChartSurface />
        <LiveExecutionFeed />
        <div className="tos-home-mid-right">
          <PanelErrorBoundary title="Portfolio">
            <div className="tos-desk-panel">
              <header className="tos-desk-panel-head">
                <span>Portfolio Overview</span>
              </header>
              <PortfolioOverviewPanel />
            </div>
          </PanelErrorBoundary>
          <PanelErrorBoundary title="Trade Like Me">
            <div className="tos-desk-panel">
              <header className="tos-desk-panel-head">
                <span>Trade Like Me (DNA)</span>
              </header>
              <TradeLikeMeWidget />
            </div>
          </PanelErrorBoundary>
        </div>
      </section>

      <section className="tos-home-row tos-home-row-bot" aria-label="Ops row">
        <ScannerDiscoveryStrip />
        <PositionsSnapshot />
        <AutonomousWorkflowStrip />
      </section>
    </div>
  )
}
