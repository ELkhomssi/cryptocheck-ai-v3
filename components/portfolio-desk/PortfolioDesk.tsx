'use client'

import { Component, Suspense, type ErrorInfo, type ReactNode, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useSolana } from '@/components/SolanaProvider'
import { AlertsPanel } from './alerts/AlertsPanel'
import { AiEmployeesPanel } from './agents/AiEmployeesPanel'
import { CoachPanel } from './coach/CoachPanel'
import { useHoldings } from './hooks/useHoldings'
import { Sidebar, type DeskNav } from './layout/Sidebar'
import { PageHeader } from './layout/PageHeader'
import { TickerTape } from './layout/TickerTape'
import { Topbar } from './layout/Topbar'
import { MarketFeeds } from './market/MarketFeeds'
import { Hero } from './portfolio/Hero'
import { HoldingsTable } from './portfolio/HoldingsTable'
import { Metrics } from './portfolio/Metrics'
import { AnalyticsPanel } from './portfolio/AnalyticsPanel'
import { AiReviewPanel } from './portfolio/AiReviewPanel'
import { PerformanceChart, usePerformance } from './portfolio/PerformanceChart'
import { ScreenerPanel } from './screener/ScreenerPanel'
import { TradePanel } from './trade/TradePanel'
import { WatchlistPanel } from './watchlist/WatchlistPanel'
import type { PortfolioAlert } from '@/types/portfolio-desk'

const RANGES = ['24H', '7D', '30D', '90D', 'ALL'] as const

const PAGE_META: Record<DeskNav, { kicker: string; title: string; subtitle: string }> = {
  portfolio: {
    kicker: '// PORTFOLIO',
    title: 'Portfolio Overview',
    subtitle: 'Track your assets, performance and analytics in real-time.',
  },
  screener: {
    kicker: '// TOKEN SCREENER',
    title: 'Token Screener',
    subtitle: 'Filter and rank live Solana markets by liquidity, risk, and AI score.',
  },
  trade: {
    kicker: '// TRADE DESK',
    title: 'Trade',
    subtitle: 'Risk-gated Jupiter swaps and tracked limit / DCA / TP / SL orders.',
  },
  watchlist: {
    kicker: '// WATCHLIST',
    title: 'Watchlist',
    subtitle: 'Persist and monitor tokens with live price, risk, and AI scores.',
  },
  alerts: {
    kicker: '// ALERTS ENGINE',
    title: 'Alerts',
    subtitle: 'Track your assets, performance and analytics in real-time.',
  },
  coach: {
    kicker: '// AI COACH',
    title: 'AI Coach',
    subtitle: 'Track your assets, performance and analytics in real-time.',
  },
  employees: {
    kicker: '// AI EMPLOYEES',
    title: 'AI Employees',
    subtitle: 'Specialized trading agents with live status and real performance scores.',
  },
  settings: {
    kicker: '// SETTINGS',
    title: 'Settings',
    subtitle: 'Track your assets, performance and analytics in real-time.',
  },
}

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
  const searchParams = useSearchParams()
  const initialNav = (searchParams.get('nav') as DeskNav | null) || 'portfolio'
  const [nav, setNav] = useState<DeskNav>(
    [
      'portfolio',
      'screener',
      'trade',
      'watchlist',
      'alerts',
      'coach',
      'employees',
      'settings',
    ].includes(initialNav)
      ? initialNav
      : 'portfolio',
  )
  const [range, setRange] = useState<(typeof RANGES)[number]>('24H')
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    const q = searchParams.get('nav') as DeskNav | null
    if (
      q &&
      [
        'portfolio',
        'screener',
        'trade',
        'watchlist',
        'alerts',
        'coach',
        'employees',
        'settings',
      ].includes(q)
    ) {
      setNav(q)
    }
  }, [searchParams])
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
        <PageHeader
          kicker={PAGE_META[nav].kicker}
          title={PAGE_META[nav].title}
          subtitle={PAGE_META[nav].subtitle}
          actions={
            nav === 'portfolio' ? (
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
            ) : null
          }
        />

        {!isConnected && nav !== 'screener' && nav !== 'watchlist' && nav !== 'employees' ? (
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

        {nav === 'screener' ? (
          <SectionErrorBoundary title="Screener">
            <Suspense
              fallback={
                <div className="pd-panel" style={{ padding: 18 }}>
                  <div className="pd-skeleton" style={{ height: 36, marginBottom: 10 }} />
                  <div className="pd-skeleton" style={{ height: 36, marginBottom: 10 }} />
                  <div className="pd-skeleton" style={{ height: 36 }} />
                </div>
              }
            >
              <ScreenerPanel />
            </Suspense>
          </SectionErrorBoundary>
        ) : null}

        {nav === 'trade' && isConnected ? (
          <SectionErrorBoundary title="Trade">
            <TradePanel />
          </SectionErrorBoundary>
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
            <SectionErrorBoundary title="Analytics">
              <AnalyticsPanel />
            </SectionErrorBoundary>
            <SectionErrorBoundary title="AI Review">
              <AiReviewPanel />
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

        {nav === 'portfolio' ? (
          <>
            <div className="pd-page-head" style={{ marginTop: 8 }}>
              <div>
                <h1>Market</h1>
                <p>Live Solana screener feeds — independently cached, never fabricated.</p>
              </div>
            </div>
            <SectionErrorBoundary title="Market">
              <MarketFeeds />
            </SectionErrorBoundary>
          </>
        ) : null}

        {nav === 'employees' ? (
          <SectionErrorBoundary title="AI Employees">
            <AiEmployeesPanel />
          </SectionErrorBoundary>
        ) : null}

        {nav === 'watchlist' ? (
          <SectionErrorBoundary title="Watchlist">
            <WatchlistPanel />
          </SectionErrorBoundary>
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
