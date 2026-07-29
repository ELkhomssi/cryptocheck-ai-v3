'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { LeftRail } from '@/features/terminal-os/shell/components/LeftRail'
import { TopBar } from '@/features/terminal-os/shell/components/TopBar'
import { PanelErrorBoundary } from '@/features/terminal-os/shared/components/PanelErrorBoundary'
import { TopTradersTicker } from '@/features/terminal-os/market-intel/components/TopTradersTicker'
import { TopTokensToday } from '@/features/terminal-os/market-intel/components/TopTokensToday'
import { WhaleMarqueeTicker } from '@/features/terminal-os/whale-tracking/components/WhaleMarqueeTicker'
import { MultiChainChartGrid } from '@/features/terminal-os/trading-workspace/components/MultiChainChartGrid'
import { IntelligenceChart } from '@/features/intelligence-chart'
import { QuickSwapCard } from '@/features/terminal-os/trading-workspace/components/QuickSwapCard'
import { PortfolioOverviewPanel } from '@/features/terminal-os/portfolio-os/components/PortfolioOverviewPanel'
import { DiscoveryPanel } from '@/features/terminal-os/discovery-engine/components/DiscoveryPanel'
import { TokenScoreScanCard } from '@/features/terminal-os/security-center/components/TokenScoreScanCard'
import { WalletScoreScanCard } from '@/features/terminal-os/security-center/components/WalletScoreScanCard'
import { AiCoachingCard } from '@/features/terminal-os/ai-coach/components/AiCoachingCard'
import { AiWorkforcePanel } from '@/features/terminal-os/ai-workforce/components/AiWorkforcePanel'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { ComingOnline, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { TerminalNavId } from '@/features/terminal-os/shared/types'
import {
  AiStatusCard,
  AiTradeLikeMeCard,
} from '@/features/terminal-os/ai-trade-like-me/components/AiTradeLikeMeCard'

/** Code-split flagship widget — home JS shouldn't pay for TLM until visited */
const TradeLikeMeWidget = dynamic(
  () =>
    import('@/features/terminal-os/ai-trade-like-me/components/TradeLikeMeWidget').then(
      (m) => m.TradeLikeMeWidget,
    ),
  { ssr: false, loading: () => <PanelSkeleton rows={6} /> },
)

function Bound({ title, children }: { title: string; children: ReactNode }) {
  return <PanelErrorBoundary title={title}>{children}</PanelErrorBoundary>
}

function ChartSurface() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)
  if (focused) {
    return (
      <Bound title="Intelligence Chart">
        <IntelligenceChart
          query={focused.id || focused.symbol}
          chain={focused.chain}
          onClose={() => setFocused(null)}
        />
      </Bound>
    )
  }
  return (
    <Bound title="Multi-Chain Charts">
      <MultiChainChartGrid />
    </Bound>
  )
}

function MainColumn() {
  const nav = useTerminalOsStore((s) => s.activeNav)

  if (nav === 'discovery') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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

  if (nav === 'ai-trading') {
    return <AiTradingWorkspace />
  }

  if (nav === 'ai-coach') {
    return (
      <Bound title="AI Coach">
        <AiCoachWorkspace />
      </Bound>
    )
  }

  if (nav === 'security' || nav === 'ai-scanner') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
        }}
      >
        <Bound title="Token Scan">
          <TokenScoreScanCard />
        </Bound>
        <Bound title="Wallet Scan">
          <WalletScoreScanCard />
        </Bound>
        <Panel title="Security Center">
          <ComingOnline label="Approval scanner, honeypot, rug timeline (Phase 4)" />
        </Panel>
      </div>
    )
  }

  if (nav === 'whale-tracking') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            Not financial advice · DYOR · Attribution metrics show “Awaiting on-chain” until wallet
            graph coverage is wired.
          </p>
        </Panel>
      </div>
    )
  }

  if (nav === 'market-intel') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Bound title="Top Tokens">
          <TopTokensToday />
        </Bound>
        <ChartSurface />
      </div>
    )
  }

  if (nav === 'settings' || nav === 'alerts' || nav === 'watchlist' || nav === 'copy-trading') {
    return <SecondaryNavStub nav={nav} />
  }

  {/* Default Terminal home — traders → tokens → 2×2 charts (whales fixed in top marquee) */}
  return (
    <>
      <Bound title="Top Traders">
        <TopTradersTicker />
      </Bound>
      <Bound title="Top Tokens">
        <TopTokensToday />
      </Bound>
      <ChartSurface />
    </>
  )
}

function AiTradingWorkspace() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Bound title="Trade Like Me">
        <TradeLikeMeWidget />
      </Bound>
    </div>
  )
}

function AiCoachWorkspace() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
      <AiCoachingCard />
      <Panel title="Coach chat">
        <ComingOnline label="Conversational Pause & Teach + proactive insights (Phase 3–4)" />
      </Panel>
    </div>
  )
}

function SecondaryNavStub({ nav }: { nav: TerminalNavId }) {
  const labels: Partial<Record<TerminalNavId, string>> = {
    settings: 'Settings',
    alerts: 'Alerts',
    watchlist: 'Watchlist',
    'copy-trading': 'Copy Trading',
  }
  return (
    <Panel title={labels[nav] ?? nav}>
      <ComingOnline label={`${labels[nav] ?? nav} workspace`} />
    </Panel>
  )
}

function RightRail() {
  return (
    <aside className="tos-right-rail" aria-label="Tools">
      <Bound title="Token Score">
        <TokenScoreScanCard />
      </Bound>
      <Bound title="Quick Swap">
        <QuickSwapCard />
      </Bound>
      <Bound title="Wallet Score">
        <WalletScoreScanCard />
      </Bound>
      <Bound title="AI Coaching">
        <AiCoachingCard />
      </Bound>
    </aside>
  )
}

export function TerminalOsShell() {
  return (
    <div className="tos-shell" data-tos-shell>
      <TopBar />
      <div className="tos-whale-slot">
        <Bound title="Top Whale Movements">
          <WhaleMarqueeTicker fixed title="Top Whale Movements" />
        </Bound>
      </div>
      <LeftRail />
      <main className="tos-main">
        <MainColumn />
      </main>
      <RightRail />
    </div>
  )
}
