'use client'

import { Component, type ErrorInfo, type ReactNode, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { AlertsPanel } from './alerts/AlertsPanel'
import { CoachPanel } from './coach/CoachPanel'
import { useHoldings } from './hooks/useHoldings'
import { Sidebar, type DeskNav } from './layout/Sidebar'
import { TickerTape } from './layout/TickerTape'
import { Topbar } from './layout/Topbar'
import { Hero } from './portfolio/Hero'
import { HoldingsTable } from './portfolio/HoldingsTable'
import { Metrics } from './portfolio/Metrics'
import { PerformanceChart, usePerformance } from './portfolio/PerformanceChart'
import type { PortfolioAlert } from '@/types/portfolio-desk'

const RANGES = ['24H', '7D', '30D', '90D', 'ALL'] as const

class SectionErrorBoundary extends Component<
  { title: string; children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null }
  static getDerivedStateFromError(err: Error) {
    return { error: err.message || 'Something went wrong' }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[portfolio-desk] ${this.props.title}`, error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="pd-panel" style={{ padding: 24 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>{this.props.title} failed</h3>
          <p style={{ color: 'var(--pd-text-dim)', fontSize: 13, marginBottom: 12 }}>
            {this.state.error}
          </p>
          <button
            type="button"
            className="pd-connect"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function PortfolioDesk() {
  const { isConnected, connect, walletAddress } = useSolana()
  const [nav, setNav] = useState<DeskNav>('portfolio')
  const [range, setRange] = useState<(typeof RANGES)[number]>('24H')
  const [mobileNav, setMobileNav] = useState(false)
  const holdingsQ = useHoldings()
  const perfQ = usePerformance(walletAddress, range)
  const alertsQ = useQuery({
    queryKey: ['portfolio-alerts-count', walletAddress],
    queryFn: async () => {
      const q = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : ''
      const res = await fetch(`/api/portfolio/alerts${q}`, { cache: 'no-store' })
      if (!res.ok) return 0
      const body = (await res.json()) as { alerts?: PortfolioAlert[] }
      return body.alerts?.length ?? 0
    },
    refetchInterval: 20_000,
    staleTime: 15_000,
  })

  return (
    <div className="pd-shell">
      {mobileNav ? (
        <button
          type="button"
          className="pd-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      ) : null}
      <Sidebar
        active={nav}
        onSelect={setNav}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />
      <Topbar alertCount={alertsQ.data ?? 0} onOpenNav={() => setMobileNav(true)} />
      <TickerTape />

      <main className="pd-main">
        <div className="pd-page-head">
          <div>
            <h1>
              {nav === 'portfolio'
                ? 'Portfolio Overview'
                : nav === 'alerts'
                  ? 'Alerts'
                  : nav === 'coach'
                    ? 'AI Coach'
                    : nav === 'watchlist'
                      ? 'Watchlist'
                      : 'Settings'}
            </h1>
            <p>Track your assets, performance and analytics in real-time.</p>
          </div>
          {nav === 'portfolio' ? (
            <div className="pd-tabs">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`pd-tab${range === r ? ' is-active' : ''}`}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {!isConnected ? (
          <div className="pd-empty pd-panel">
            <h3>Connect your wallet to open the desk</h3>
            <p>
              Live balances, Jupiter prices, performance history, alerts, and AI Coach all require a
              connected Solana wallet. Nothing is fabricated.
            </p>
            <button type="button" className="pd-connect" onClick={() => void connect()}>
              Connect Wallet
            </button>
          </div>
        ) : null}

        {isConnected && holdingsQ.isError ? (
          <div className="pd-panel" style={{ padding: 16, marginBottom: 16, color: 'var(--pd-negative)' }}>
            {(holdingsQ.error as Error)?.message || 'Holdings failed'}{' '}
            <button type="button" className="pd-connect" style={{ marginLeft: 8 }} onClick={() => void holdingsQ.refetch()}>
              Retry
            </button>
          </div>
        ) : null}

        {nav === 'portfolio' && isConnected ? (
          <>
            <SectionErrorBoundary title="Hero">
              <Hero
                data={holdingsQ.data}
                loading={holdingsQ.isLoading}
                spark={perfQ.data?.series ?? []}
                range={range}
              />
            </SectionErrorBoundary>
            <SectionErrorBoundary title="Metrics">
              <Metrics data={holdingsQ.data} loading={holdingsQ.isLoading} />
            </SectionErrorBoundary>
            <SectionErrorBoundary title="Holdings">
              <HoldingsTable
                holdings={holdingsQ.data?.holdings ?? []}
                loading={holdingsQ.isLoading}
                connected={isConnected}
              />
            </SectionErrorBoundary>
            <SectionErrorBoundary title="Performance">
              <PerformanceChart
                series={perfQ.data?.series ?? []}
                loading={perfQ.isLoading}
                note={perfQ.data?.simplification}
              />
            </SectionErrorBoundary>
          </>
        ) : null}

        {nav === 'watchlist' ? (
          <div className="pd-panel pd-empty">
            <h3>Watchlist</h3>
            <p>Ticker watchlist is live in the tape. Personal watchlist UI lands next.</p>
          </div>
        ) : null}

        {nav === 'settings' ? (
          <div className="pd-panel pd-empty">
            <h3>Settings</h3>
            <p>Use the sidebar Theme control for dark/light. Wallet disconnect is on the topbar chip.</p>
          </div>
        ) : null}

        {(nav === 'alerts' || nav === 'coach') && isConnected ? (
          <div className="pd-panel" style={{ padding: 16 }}>
            <SectionErrorBoundary title={nav === 'alerts' ? 'Alerts' : 'AI Coach'}>
              {nav === 'alerts' ? <AlertsPanel /> : <CoachPanel />}
            </SectionErrorBoundary>
          </div>
        ) : null}
      </main>

      <aside className="pd-aside">
        <SectionErrorBoundary title="Alerts">
          <AlertsPanel />
        </SectionErrorBoundary>
        <SectionErrorBoundary title="AI Coach">
          <CoachPanel />
        </SectionErrorBoundary>
      </aside>
    </div>
  )
}
