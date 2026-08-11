'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, type ReactNode } from 'react'
import { LeftRail } from '@/features/terminal-os/shell/components/LeftRail'
import { TopBar } from '@/features/terminal-os/shell/components/TopBar'
import { PanelErrorBoundary } from '@/features/terminal-os/shared/components/PanelErrorBoundary'
import { TopTokensToday } from '@/features/terminal-os/market-intel/components/TopTokensToday'
import { WhaleMarqueeTicker } from '@/features/terminal-os/whale-tracking/components/WhaleMarqueeTicker'
import { MoneyLifecycleRibbon } from '@/features/terminal-os/money-lifecycle'
import { IntelligenceChart } from '@/features/intelligence-chart'
import { ExecutionDeskShell } from '@/features/execution-desk'
import { QuickSwapCard } from '@/features/terminal-os/trading-workspace/components/QuickSwapCard'
import { PortfolioOverviewPanel } from '@/features/terminal-os/portfolio-os/components/PortfolioOverviewPanel'
import { DiscoveryPanel } from '@/features/terminal-os/discovery-engine/components/DiscoveryPanel'
import { TokenScoreScanCard } from '@/features/terminal-os/security-center/components/TokenScoreScanCard'
import { WalletScoreScanCard } from '@/features/terminal-os/security-center/components/WalletScoreScanCard'
import { AiWorkforcePanel } from '@/features/terminal-os/ai-workforce/components/AiWorkforcePanel'
import { ScoutPanel } from '@/features/terminal-os/scout/components/ScoutPanel'
import { AlertsWorkspace } from '@/features/terminal-os/alerts/AlertsWorkspace'
import { AlertToastHost } from '@/features/terminal-os/alerts/AlertToastHost'
import { AlertEvaluateBridge } from '@/features/terminal-os/alerts/AlertEvaluateBridge'
import {
  AiCoachWorkspace,
  MissionControlWorkspace,
} from '@/features/terminal-os/shell/components/MissionAndCoachWorkspaces'
import { PersistentCoachRail } from '@/features/terminal-os/shell/components/PersistentCoachRail'
import { TerminalOsHomeDesk } from '@/features/terminal-os/shell/components/TerminalOsHomeDesk'
import { AiRecommendationCard } from '@/features/terminal-os/shell/components/AiRecommendationCard'
import { SystemStatusGauges } from '@/features/terminal-os/shell/components/SystemStatusGauges'
import { TradeLikeMeDnaCard } from '@/features/terminal-os/shell/components/HomeDeskPanels'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { TerminalNavId } from '@/features/terminal-os/shared/types'

/** Code-split flagship widget — home JS shouldn't pay for TLM until visited */
const TradeLikeMeWidget = dynamic(
  () =>
    import('@/features/terminal-os/ai-trade-like-me/components/TradeLikeMeWidget').then(
      (m) => m.TradeLikeMeWidget,
    ),
  { ssr: false, loading: () => <PanelSkeleton rows={6} /> },
)

/** AI Gateway = existing Intelligence Swap elevated to centerpiece (Layer 4 only) */
const IntelligenceSwap = dynamic(
  () => import('@/features/ai-os/components/IntelligenceSwap').then((m) => m.IntelligenceSwap),
  { ssr: false, loading: () => <PanelSkeleton rows={8} /> },
)

function Bound({ title, children }: { title: string; children: ReactNode }) {
  return <PanelErrorBoundary title={title}>{children}</PanelErrorBoundary>
}

/** Sole chart surface — IntelligenceChart only (no MultiChain / Candlestick legacy). */
function ChartSurface() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)
  const query = focused?.id || focused?.symbol || 'SOL'
  const chain = focused?.chain || 'solana'
  return (
    <Bound title="Intelligence Chart">
      <IntelligenceChart
        query={query}
        chain={chain}
        onClose={focused ? () => setFocused(null) : undefined}
      />
    </Bound>
  )
}

function MainColumn() {
  const nav = useTerminalOsStore((s) => s.activeNav)

  if (nav === 'discovery') {
    return (
      <div className="tos-stack">
        <Bound title="Discovery">
          <DiscoveryPanel />
        </Bound>
      </div>
    )
  }

  if (nav === 'ai-workforce') {
    return (
      <Bound title="AI Workforce">
        <AiWorkforcePanel />
      </Bound>
    )
  }

  if (nav === 'portfolio') {
    return (
      <Bound title="Portfolio OS">
        <PortfolioOverviewPanel />
      </Bound>
    )
  }

  if (nav === 'execution') {
    return (
      <Bound title="Execution Desk">
        <ExecutionDeskShell />
      </Bound>
    )
  }

  if (nav === 'ai-trading') {
    return <AiTradingWorkspace />
  }

  if (nav === 'mission-control') {
    return (
      <Bound title="Mission Control">
        <MissionControlWorkspace />
      </Bound>
    )
  }

  if (nav === 'ai-coach') {
    return (
      <Bound title="AI Coach">
        <AiCoachWorkspace />
      </Bound>
    )
  }

  if (nav === 'scout') {
    return (
      <Bound title="Scout">
        <ScoutPanel />
      </Bound>
    )
  }

  if (nav === 'security' || nav === 'ai-scanner') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--tos-space-3)',
        }}
      >
        <Bound title="Token Scan">
          <TokenScoreScanCard />
        </Bound>
        <Bound title="Wallet Scan">
          <WalletScoreScanCard />
        </Bound>
        <Panel title="Security Center">
          <EmptyState message="Token + wallet scans above are live via scan gateway and holdings. Approval/honeypot timeline uses the same engines when a mint is focused." />
        </Panel>
      </div>
    )
  }

  if (nav === 'whale-tracking') {
    return (
      <div className="tos-stack">
        <Panel title="Whale Tracking Desk">
          <p style={{ color: 'var(--tos-text-secondary)', fontSize: 'var(--tos-fs-md)', lineHeight: 1.55 }}>
            Live high-confidence whale flows stream in the marquee above. Hover any chip for wallet
            intelligence; click to open the full Whale Intelligence panel. Filters: All · Solana ·
            Ethereum · BNB · Base · Smart Money.
          </p>
          <p
            className="tos-muted"
            style={{ marginTop: 10, fontSize: 'var(--tos-fs-xs)' }}
          >
            Not financial advice · DYOR · Attribution fields show Unavailable when graph data is not
            present for that wallet.
          </p>
        </Panel>
      </div>
    )
  }

  if (nav === 'market-intel') {
    return (
      <div className="tos-stack">
        <Bound title="Top Tokens">
          <TopTokensToday />
        </Bound>
      </div>
    )
  }

  if (nav === 'chart-intelligence') {
    return (
      <div className="tos-stack">
        <ChartSurface />
      </div>
    )
  }

  if (nav === 'backtesting') {
    return (
      <Panel title="Backtesting Lab">
        <EmptyState message="Backtesting Lab awaits persisted strategy simulation runs. Paper/sim results will appear here when the execution audit log records them — no fabricated win rates." />
      </Panel>
    )
  }

  if (nav === 'journal') {
    return <JournalWorkspace />
  }

  if (nav === 'settings') {
    return (
      <div className="tos-stack">
        <Bound title="System Health">
          <SystemStatusGauges />
        </Bound>
        <Panel title="System Health">
          <EmptyState message="Gauges above read live /api/health and provider health. Engine counts never invent 12/12 — they show real check totals." />
        </Panel>
      </div>
    )
  }

  if (nav === 'alerts') {
    return (
      <Bound title="Alerts">
        <AlertsWorkspace />
      </Bound>
    )
  }

  if (nav === 'watchlist' || nav === 'copy-trading') {
    return <SecondaryNavStub nav={nav} />
  }

  // Default / AI Gateway — full reference multi-panel desk
  return <TerminalOsHomeDesk />
}

function JournalWorkspace() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const connected = useTerminalOsStore((s) => s.walletConnected)
  return (
    <Panel title="Directory & Journal" live>
      {!connected || !wallet ? (
        <EmptyState message="Connect a Solana wallet to load captured trades and activity." />
      ) : (
        <JournalFeed wallet={wallet} />
      )}
    </Panel>
  )
}

function JournalFeed({ wallet }: { wallet: string }) {
  const [rows, setRows] = useState<
    Array<{ id: string; side: string; tokenSymbol: string; entryAt: string; sample?: boolean }>
  >([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    void fetch(`/api/terminal-os/captured-trades?wallet=${encodeURIComponent(wallet)}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Journal unavailable')
        const body = (await res.json()) as {
          trades?: Array<{
            id: string
            side: string
            tokenSymbol: string
            entryAt: string
            sample?: boolean
          }>
        }
        if (!c) setRows((body.trades ?? []).filter((t) => !t.sample))
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
    return () => {
      c = true
    }
  }, [wallet])

  if (error) return <EmptyState message={error} />
  if (!rows.length) {
    return <EmptyState message="No captured activity yet — fills and rejected Decisions appear here." />
  }
  return (
    <ul className="tos-stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {rows.slice(0, 40).map((t) => (
        <li key={t.id} style={{ fontSize: 'var(--tos-fs-sm)' }}>
          <strong>
            {t.side.toUpperCase()} ${t.tokenSymbol}
          </strong>
          <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)' }}>
            {new Date(t.entryAt).toLocaleString()}
          </div>
        </li>
      ))}
    </ul>
  )
}

function AiGatewayCenterpiece() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  return (
    <IntelligenceSwap
      initialBuyMint={focused?.id ?? null}
      initialBuySymbol={focused?.symbol ?? null}
    />
  )
}

function AiTradingWorkspace() {
  return (
    <div className="tos-stack">
      <Bound title="AI Gateway">
        <AiGatewayCenterpiece />
      </Bound>
      <Bound title="Trade Like Me">
        <TradeLikeMeWidget />
      </Bound>
    </div>
  )
}

function SecondaryNavStub({ nav }: { nav: TerminalNavId }) {
  if (nav === 'watchlist') {
    return (
      <Panel title="Watchlist">
        <EmptyState message="Focus a token anywhere in Terminal OS — it drives Chart, Scanner, and Execution. Dedicated watchlist persistence ships next without changing this layout." />
      </Panel>
    )
  }
  if (nav === 'copy-trading') {
    return (
      <Panel title="Copy Trading">
        <EmptyState message="Copy Trading stays OFF by default. Use Trade Like Me for explainable advice — autonomy is gated separately." />
      </Panel>
    )
  }
  return (
    <Panel title={nav}>
      <EmptyState message="This surface uses the live wallet session and feature flags already in Terminal OS." />
    </Panel>
  )
}

function RightRail({ homeMode }: { homeMode: boolean }) {
  return (
    <aside className="tos-right-rail" aria-label="AI Coach and tools" data-tos-right="coach">
      <Bound title="AI Coach">
        <PersistentCoachRail />
      </Bound>      {homeMode ? (
        <>
          <Bound title="AI Recommendation">
            <AiRecommendationCard />
          </Bound>
          <Bound title="Trade Like Me DNA">
            <TradeLikeMeDnaCard />
          </Bound>
        </>
      ) : (
        <>
          <Bound title="Token Score">
            <TokenScoreScanCard />
          </Bound>
          <Bound title="Quick Swap">
            <QuickSwapCard />
          </Bound>
          <Bound title="Wallet Score">
            <WalletScoreScanCard />
          </Bound>
        </>
      )}
    </aside>
  )
}

export function TerminalOsShell() {
  const activeNav = useTerminalOsStore((s) => s.activeNav)
  const homeMode = activeNav === 'terminal'

  return (
    <div className="tos-shell" data-tos-shell data-tos-home={homeMode ? 'true' : undefined}>
      <Bound title="Top Bar">
        <TopBar />
      </Bound>
      <AlertEvaluateBridge />
      <AlertToastHost />
      <div className="tos-whale-slot">
        <Bound title="Top Whale Movements">
          <WhaleMarqueeTicker fixed title="Top Whale Movements" />
        </Bound>
      </div>
      {!homeMode ? (
        <div className="tos-lifecycle-slot">
          <Bound title="Money Lifecycle">
            <MoneyLifecycleRibbon />
          </Bound>
        </div>
      ) : (
        <div className="tos-lifecycle-slot" aria-hidden />
      )}
      <Bound title="Navigation">
        <LeftRail />
      </Bound>
      <main className="tos-main">
        <MainColumn />
      </main>
      <RightRail homeMode={homeMode} />
    </div>
  )
}
