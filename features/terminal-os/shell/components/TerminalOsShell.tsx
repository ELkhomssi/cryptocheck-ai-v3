'use client'

import type { ReactNode } from 'react'
import { LeftRail } from '@/features/terminal-os/shell/components/LeftRail'
import { TopBar } from '@/features/terminal-os/shell/components/TopBar'
import { PanelErrorBoundary } from '@/features/terminal-os/shared/components/PanelErrorBoundary'
import { TopTradersTicker } from '@/features/terminal-os/market-intel/components/TopTradersTicker'
import { TopTokensToday } from '@/features/terminal-os/market-intel/components/TopTokensToday'
import { TopWhaleMovements } from '@/features/terminal-os/whale-tracking/components/TopWhaleMovements'
import { MultiChainChartGrid } from '@/features/terminal-os/trading-workspace/components/MultiChainChartGrid'
import { QuickSwapCard } from '@/features/terminal-os/trading-workspace/components/QuickSwapCard'
import { PortfolioOverviewPanel } from '@/features/terminal-os/portfolio-os/components/PortfolioOverviewPanel'
import { TokenScoreScanCard } from '@/features/terminal-os/security-center/components/TokenScoreScanCard'
import { WalletScoreScanCard } from '@/features/terminal-os/security-center/components/WalletScoreScanCard'
import { AiCoachingCard } from '@/features/terminal-os/ai-coach/components/AiCoachingCard'
import { DiscoveryPanel } from '@/features/terminal-os/discovery-engine/components/DiscoveryPanel'
import { AiWorkforcePanel } from '@/features/terminal-os/ai-workforce/components/AiWorkforcePanel'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { ComingOnline } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { TerminalNavId } from '@/features/terminal-os/shared/types'
import {
  AiStatusCard,
  AiTradeLikeMeCard,
} from '@/features/terminal-os/ai-trade-like-me/components/AiTradeLikeMeCard'

function Bound({ title, children }: { title: string; children: ReactNode }) {
  return <PanelErrorBoundary title={title}>{children}</PanelErrorBoundary>
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
      <Bound title="Whale Tracking">
        <TopWhaleMovements />
      </Bound>
    )
  }

  if (nav === 'market-intel') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Bound title="Top Tokens">
          <TopTokensToday />
        </Bound>
        <Bound title="Charts">
          <MultiChainChartGrid />
        </Bound>
      </div>
    )
  }

  if (nav === 'settings' || nav === 'alerts' || nav === 'watchlist' || nav === 'copy-trading') {
    return <SecondaryNavStub nav={nav} />
  }

  // Default Terminal home — all seven layer panels
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Bound title="Top Traders">
        <TopTradersTicker />
      </Bound>
      <Bound title="Whale Movements">
        <TopWhaleMovements />
      </Bound>
      <Bound title="Top Tokens">
        <TopTokensToday />
      </Bound>
      <Bound title="Multi-Chain Charts">
        <MultiChainChartGrid />
      </Bound>
      <Bound title="Portfolio Overview">
        <PortfolioOverviewPanel />
      </Bound>
      <Bound title="Discovery">
        <DiscoveryPanel />
      </Bound>
    </div>
  )
}

function AiTradingWorkspace() {
  const flags = useTerminalOsStore((s) => s.featureFlags)
  const tier = useTerminalOsStore((s) => s.autonomyTier)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Bound title="AI Trade Like Me">
        <div className="tos-panel">
          <div className="tos-panel-body">
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
              Pause & Teach · Behavioral Engine
            </h2>
            <p style={{ fontSize: 13, color: 'var(--tos-text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
              Phase 3 will capture trades/scans and derive your TraderProfile. Autonomy stays
              permissioned and flagged OFF until Phase 6.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <AiTradeLikeMeCard />
              <AiStatusCard />
            </div>
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                border: '1px solid var(--tos-border-subtle)',
                background: 'var(--tos-bg-panel)',
              }}
            >
              <div className="tos-muted" style={{ fontSize: 11, marginBottom: 6 }}>
                Teach the model (preview)
              </div>
              <textarea
                className="tos-input"
                rows={3}
                placeholder='e.g. "I always take profit at 2x and never hold through a 30% drawdown"'
                disabled
              />
              <p className="tos-muted" style={{ fontSize: 10, marginTop: 8 }}>
                Flags: autonomousTrading={String(flags.autonomousTrading)} · tier={tier}
              </p>
            </div>
          </div>
        </div>
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
      <LeftRail />
      <main className="tos-main">
        <MainColumn />
      </main>
      <RightRail />
    </div>
  )
}
