'use client'

/**
 * Mission Control home — 1:1 reference composition (full-width 3 columns).
 * KERNEL: Decision / holdings / market / whales / alerts / coach — never invents scores.
 *
 * Layout (matches reference A→Z):
 * LEFT: metrics · market overview · chart · liquidity
 * MIDDLE: Trade Like Me · AI Signals + Wallet Intelligence · positions
 * RIGHT: AI Coach · risk heatmap · allocation · news/alerts
 * FOOTER: system status bar
 */

import { IntelligenceChart } from '@/features/intelligence-chart'
import { PortfolioOverviewPanel } from '@/features/terminal-os/portfolio-os/components/PortfolioOverviewPanel'
import { PanelErrorBoundary } from '@/features/terminal-os/shared/components/PanelErrorBoundary'
import { useTerminalOsStore } from '@/stores/terminal-os'
import {
  OnChainHeatmap,
  PositionsSnapshot,
} from '@/features/terminal-os/shell/components/HomeDeskPanels'
import { PersistentCoachRail } from '@/features/terminal-os/shell/components/PersistentCoachRail'
import { AiRecommendationCard } from '@/features/terminal-os/shell/components/AiRecommendationCard'
import { WalletScoreScanCard } from '@/features/terminal-os/security-center/components/WalletScoreScanCard'
import {
  MissionAiSignals,
  MissionAllocationPanel,
  MissionFooterStatus,
  MissionLiquidityPanel,
  MissionMarketOverview,
  MissionMetricsStrip,
  MissionNewsAlerts,
  MissionTradeSuite,
} from '@/features/terminal-os/shell/components/MissionControlPanels'

function ChartSurface() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)
  const query = focused?.id || focused?.symbol || 'SOL'
  const chain = focused?.chain || 'solana'
  return (
    <PanelErrorBoundary title="Trading Chart">
      <div className="tos-mc-chart" data-tos-mc-chart="true">
        <header className="tos-mc-panel-head">
          <span>
            Trading Chart · {focused?.symbol ?? 'SOL'}/USDC
          </span>
          <span className="tos-desk-live" data-on="true">
            AI Overlay
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
  return (
    <div
      className="tos-home-desk tos-mc-desk"
      data-tos-home-desk="true"
      data-tos-mc="v1"
      data-tos-ref="mission-control-1to1"
    >
      <div className="tos-mc-grid" aria-label="Mission Control command center">
        <div className="tos-mc-col tos-mc-col-left">
          <PanelErrorBoundary title="Mission metrics">
            <MissionMetricsStrip />
          </PanelErrorBoundary>
          <PanelErrorBoundary title="Market Overview">
            <MissionMarketOverview />
          </PanelErrorBoundary>
          <ChartSurface />
          <PanelErrorBoundary title="Liquidity">
            <MissionLiquidityPanel />
          </PanelErrorBoundary>
        </div>

        <div className="tos-mc-col tos-mc-col-mid">
          <PanelErrorBoundary title="Trade Like Me">
            <MissionTradeSuite />
          </PanelErrorBoundary>
          <div className="tos-mc-dual">
            <PanelErrorBoundary title="AI Signals">
              <MissionAiSignals />
            </PanelErrorBoundary>
            <PanelErrorBoundary title="Wallet Intelligence">
              <div className="tos-mc-wallet" data-tos-mc-wallet="true">
                <header className="tos-mc-panel-head">
                  <span>Wallet Intelligence</span>
                </header>
                <WalletScoreScanCard />
              </div>
            </PanelErrorBoundary>
          </div>
          <PanelErrorBoundary title="Position Overview">
            <div className="tos-mc-positions" data-tos-mc-positions="true">
              <header className="tos-mc-panel-head">
                <span>Position Overview</span>
              </header>
              <PositionsSnapshot />
              <div className="tos-mc-positions-compact">
                <PortfolioOverviewPanel compact />
              </div>
            </div>
          </PanelErrorBoundary>
        </div>

        <div className="tos-mc-col tos-mc-col-right">
          <PanelErrorBoundary title="AI Coaching">
            <div className="tos-mc-coach" data-tos-mc-coach="true">
              <header className="tos-mc-panel-head">
                <span>AI Coaching</span>
              </header>
              <PersistentCoachRail />
              <AiRecommendationCard />
            </div>
          </PanelErrorBoundary>
          <PanelErrorBoundary title="Risk Heatmap">
            <div className="tos-mc-heat" data-tos-mc-heat="true">
              <header className="tos-mc-panel-head">
                <span>Risk Heatmap</span>
              </header>
              <OnChainHeatmap />
            </div>
          </PanelErrorBoundary>
          <PanelErrorBoundary title="Portfolio Allocation">
            <MissionAllocationPanel />
          </PanelErrorBoundary>
          <PanelErrorBoundary title="News & Alerts">
            <MissionNewsAlerts />
          </PanelErrorBoundary>
        </div>
      </div>

      <PanelErrorBoundary title="System status">
        <MissionFooterStatus />
      </PanelErrorBoundary>
    </div>
  )
}
