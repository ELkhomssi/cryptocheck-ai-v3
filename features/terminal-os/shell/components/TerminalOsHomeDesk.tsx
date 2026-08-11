'use client'

/**
 * Terminal OS home — reference multi-panel command desk (1:1 structure).
 * KERNEL: every panel reads Decision / holdings / attention / DNA / health — never invents.
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
  OnChainHeatmap,
  PositionsSnapshot,
  ScannerDiscoveryStrip,
} from '@/features/terminal-os/shell/components/HomeDeskPanels'
import { SystemStatusGauges } from '@/features/terminal-os/shell/components/SystemStatusGauges'

const IntelligenceSwap = dynamic(
  () => import('@/features/ai-os/components/IntelligenceSwap').then((m) => m.IntelligenceSwap),
  { ssr: false, loading: () => <PanelSkeleton rows={8} /> },
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
    <div className="tos-home-desk" data-tos-home-desk="true" data-tos-ref="v1">
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

        <PanelErrorBoundary title="AI Brain Map">
          <DecisionBrainSpokes />
        </PanelErrorBoundary>
        <PanelErrorBoundary title="Current Missions">
          <CurrentMissionsPanel />
        </PanelErrorBoundary>
      </section>

      <section className="tos-home-row tos-home-row-mid" aria-label="Market row">
        <ChartSurface />
        <PanelErrorBoundary title="Live Execution">
          <LiveExecutionFeed />
        </PanelErrorBoundary>
        <PanelErrorBoundary title="Portfolio">
          <div className="tos-desk-panel tos-desk-portfolio" data-tos-portfolio="true">
            <header className="tos-desk-panel-head">
              <span>Portfolio Overview</span>
            </header>
            <PortfolioOverviewPanel compact />
          </div>
        </PanelErrorBoundary>
      </section>

      <section className="tos-home-row tos-home-row-bot" aria-label="Ops row">
        <PanelErrorBoundary title="System Status">
          <SystemStatusGauges />
        </PanelErrorBoundary>
        <PanelErrorBoundary title="Scanner">
          <ScannerDiscoveryStrip />
        </PanelErrorBoundary>
        <PanelErrorBoundary title="Heatmap">
          <OnChainHeatmap />
        </PanelErrorBoundary>
        <PanelErrorBoundary title="Positions">
          <PositionsSnapshot />
        </PanelErrorBoundary>
        <div className="tos-home-bot-stack">
          <PanelErrorBoundary title="Workflow">
            <AutonomousWorkflowStrip />
          </PanelErrorBoundary>
        </div>
      </section>
    </div>
  )
}
