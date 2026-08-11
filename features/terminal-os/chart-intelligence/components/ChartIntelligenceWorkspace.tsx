'use client'

/**
 * Chart Intelligence workspace — reference command layout.
 * CENTER: IntelligenceChart · SIDE: wallet holdings + score scan · TOP: wallet Decision alerts.
 *
 * KERNEL CONNECTION DECLARATION
 * - Emits: none into capture (presentation). Clicking alert focuses token for chart.
 * - Reads: published Decision (BUY/SELL/EXIT), /api/portfolio/holdings, whale feed, scan cards.
 * - Price/whale rows are evidence only — action labels come from Decision, never a client classifier.
 */

import { IntelligenceChart } from '@/features/intelligence-chart'
import { PortfolioOverviewPanel } from '@/features/terminal-os/portfolio-os/components/PortfolioOverviewPanel'
import { WalletScoreScanCard } from '@/features/terminal-os/security-center/components/WalletScoreScanCard'
import { TokenScoreScanCard } from '@/features/terminal-os/security-center/components/TokenScoreScanCard'
import { PanelErrorBoundary } from '@/features/terminal-os/shared/components/PanelErrorBoundary'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { WalletDecisionAlertsStrip } from '@/features/terminal-os/chart-intelligence/components/WalletDecisionAlertsStrip'

export function ChartIntelligenceWorkspace() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)
  const query = focused?.id || focused?.symbol || 'SOL'
  const chain = focused?.chain || 'solana'

  return (
    <div className="tos-chart-ws" data-tos-chart-workspace="true">
      <PanelErrorBoundary title="Wallet alerts">
        <WalletDecisionAlertsStrip />
      </PanelErrorBoundary>

      <div className="tos-chart-ws-body">
        <section className="tos-chart-ws-center" aria-label="Chart Intelligence">
          <PanelErrorBoundary title="Intelligence Chart">
            <div className="tos-desk-panel tos-chart-ws-chart" data-tos-chart="true">
              <header className="tos-desk-panel-head">
                <span>Chart Intelligence</span>
                <span className="tos-desk-live" data-on="true">
                  {focused?.symbol ?? 'SOL'} · {chain}
                </span>
              </header>
              <IntelligenceChart
                query={query}
                chain={chain}
                onClose={focused ? () => setFocused(null) : undefined}
              />
            </div>
          </PanelErrorBoundary>
        </section>

        <aside className="tos-chart-ws-side" aria-label="Wallet and score scan">
          <PanelErrorBoundary title="Wallet">
            <div className="tos-desk-panel" data-tos-chart-wallet="true">
              <header className="tos-desk-panel-head">
                <span>Client wallet</span>
                <span className="tos-desk-live" data-on="true">
                  Holdings
                </span>
              </header>
              <PortfolioOverviewPanel compact />
            </div>
          </PanelErrorBoundary>
          <PanelErrorBoundary title="Wallet Score">
            <WalletScoreScanCard />
          </PanelErrorBoundary>
          <PanelErrorBoundary title="Token Score">
            <TokenScoreScanCard />
          </PanelErrorBoundary>
        </aside>
      </div>
    </div>
  )
}
