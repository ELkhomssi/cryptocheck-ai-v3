'use client'

/**
 * Classic Terminal PRO home — AI Gateway (bank-simple) + market ribbons + Chart Intelligence.
 * KERNEL: Decision / DNA / scan gateway / risk-gated swap — never invents scores.
 */

import dynamic from 'next/dynamic'
import { IntelligenceChart } from '@/features/intelligence-chart'
import { PanelErrorBoundary } from '@/features/terminal-os/shared/components/PanelErrorBoundary'
import { PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { TopTradersTicker } from '@/features/terminal-os/market-intel/components/TopTradersTicker'
import { TopTokensToday } from '@/features/terminal-os/market-intel/components/TopTokensToday'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { SOL_MINT } from '@/lib/portfolio-desk/constants'

const IntelligenceSwap = dynamic(
  () => import('@/features/ai-os/components/IntelligenceSwap').then((m) => m.IntelligenceSwap),
  { ssr: false, loading: () => <PanelSkeleton rows={8} /> },
)

function ChartSurface() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)
  const query = focused?.id || focused?.symbol || SOL_MINT
  const chain = focused?.chain && focused.chain !== 'all' ? focused.chain : 'solana'
  return (
    <PanelErrorBoundary title="Intelligence Chart">
      <div className="tos-classic-chart" data-tos-classic-chart="true">
        <IntelligenceChart
          query={query}
          chain={chain}
          onClose={focused ? () => setFocused(null) : undefined}
        />
      </div>
    </PanelErrorBoundary>
  )
}

/**
 * Honest wallet-risk shield — Security Scanner + Decision DANGER gating.
 * NOT a guarantee of fewer losses (Step 2 carve-out).
 */
function WalletRiskShield() {
  return (
    <aside className="tos-wallet-shield" data-tos-wallet-shield="true" aria-label="Wallet risk shield">
      <strong>Wallet risk shield</strong>
      <p>
        Before you sign, Security Scanner + Decision Engine can <em>block DANGER</em> entries and
        surface EXIT when evidence turns against a holding. Trade Like Me learns <em>your</em> method
        (entries + exits) — advise-only until you opt in. Not a guarantee of fewer losses · DYOR.
      </p>
    </aside>
  )
}

export function TerminalOsHomeDesk() {
  const focused = useTerminalOsStore((s) => s.focusedToken)

  return (
    <div
      className="tos-home-desk tos-classic-desk"
      data-tos-home-desk="true"
      data-tos-classic="v6"
      data-tos-ref="terminal-pro"
    >
      <WalletRiskShield />

      <PanelErrorBoundary title="AI Gateway">
        <div className="tos-classic-gateway" data-tos-gateway-bank="true">
          <header className="tos-classic-gateway-head">
            <div>
              <h2>AI Gateway</h2>
              <p>
                Bank-simple desk — review the Decision, see total cost, Simulate, then your wallet
                signs. Same risk-gated Jupiter path.
              </p>
            </div>
            <span className="tos-desk-live" data-on="true">
              Pro
            </span>
          </header>
          <IntelligenceSwap
            initialBuyMint={focused?.id ?? null}
            initialBuySymbol={focused?.symbol ?? null}
          />
        </div>
      </PanelErrorBoundary>

      <PanelErrorBoundary title="Top Traders">
        <TopTradersTicker />
      </PanelErrorBoundary>

      <PanelErrorBoundary title="Top Tokens">
        <TopTokensToday />
      </PanelErrorBoundary>

      <ChartSurface />
    </div>
  )
}
