'use client'

/**
 * Portfolio Desk shell — Phase 15 OS IA.
 * Reorganize/reframe only: existing panels remain reachable via new or legacy nav.
 */

import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSolana } from '@/components/SolanaProvider'
import { AiEmployeesPanel } from './agents/AiEmployeesPanel'
import { AutomationPanel } from './automation/AutomationPanel'
import { CoachPanel } from './coach/CoachPanel'
import { useHoldings } from './hooks/useHoldings'
import { Sidebar, type DeskNav } from './layout/Sidebar'
import { PageHeader } from './layout/PageHeader'
import { TickerTape } from './layout/TickerTape'
import { Topbar } from './layout/Topbar'
import { LaunchLabPanel } from './launchlab/LaunchLabPanel'
import { MarketFeeds } from './market/MarketFeeds'
import { MarketIntelligencePanel } from './market/MarketIntelligencePanel'
import { MissionControlPanel } from './mission/MissionControlPanel'
import { MissionFeedPanel } from './mission/MissionFeedPanel'
import { Hero } from './portfolio/Hero'
import { HoldingsTable } from './portfolio/HoldingsTable'
import { Metrics } from './portfolio/Metrics'
import { AnalyticsPanel } from './portfolio/AnalyticsPanel'
import { AiReviewPanel } from './portfolio/AiReviewPanel'
import { PerformanceChart, usePerformance } from './portfolio/PerformanceChart'
import { TokenInspectPanel } from './token/TokenInspectPanel'
import { TradePanel } from './trade/TradePanel'
import { SettingsPanel } from './settings/SettingsPanel'
import {
  marketTabFromLegacy,
  normalizeDeskNav,
  PAGE_META,
  PUBLIC_NAV,
} from '@/lib/portfolio-desk/nav'
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
  const router = useRouter()
  const { isConnected, connect, walletAddress } = useSolana()
  const searchParams = useSearchParams()
  const rawNav = searchParams.get('nav')
  const initialNav = normalizeDeskNav(rawNav)
  const focusMint = (searchParams.get('mint') || '').trim()
  const marketTab =
    searchParams.get('tab') || marketTabFromLegacy(rawNav) || 'discovery'
  const [nav, setNav] = useState<DeskNav>(initialNav)
  const [range, setRange] = useState<(typeof RANGES)[number]>('24H')
  const [mobileNav, setMobileNav] = useState(false)

  const setDeskNav = (id: DeskNav) => {
    const next = normalizeDeskNav(id)
    setNav(next)
    const p = new URLSearchParams(searchParams.toString())
    p.set('nav', next)
    if (next !== 'market') p.delete('tab')
    if (id === 'watchlist') p.set('tab', 'tracked')
    router.replace(`?${p.toString()}`, { scroll: false })
  }

  const clearMint = () => {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('mint')
    const qs = p.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }

  const goTrade = (mint: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('nav', 'trade')
    p.set('mint', mint)
    setNav('trade')
    router.replace(`?${p.toString()}`, { scroll: false })
  }

  const goWatch = (mint: string, symbol?: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('nav', 'market')
    p.set('tab', 'tracked')
    p.set('mint', mint)
    if (symbol) p.set('symbol', symbol)
    setNav('market')
    router.replace(`?${p.toString()}`, { scroll: false })
  }

  useEffect(() => {
    setNav(normalizeDeskNav(searchParams.get('nav')))
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

  const meta = PAGE_META[nav]
  const needsWallet = !PUBLIC_NAV.has(nav)

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
        onSelect={setDeskNav}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />
      <Topbar
        alertCount={alertsQ.data ?? 0}
        onOpenNav={() => setMobileNav(true)}
        onOpenFeed={() => setDeskNav('feed')}
        onSelectToken={(row) => {
          const p = new URLSearchParams(searchParams.toString())
          p.set('mint', row.mint)
          router.replace(`?${p.toString()}`, { scroll: false })
        }}
      />
      <TickerTape />

      <main className="pd-main">
        {nav === 'mission' || nav === 'market' || nav === 'screener' || nav === 'watchlist' ? null : (
          <PageHeader
            kicker={meta.kicker}
            title={meta.title}
            subtitle={meta.subtitle}
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
        )}

        {focusMint.length >= 32 ? (
          <SectionErrorBoundary title="Token">
            <TokenInspectPanel
              mint={focusMint}
              onClose={clearMint}
              onTrade={goTrade}
              onWatch={goWatch}
            />
          </SectionErrorBoundary>
        ) : null}

        {!isConnected && needsWallet ? (
          <div className="pd-empty pd-panel">
            <h3>Connect your wallet to open this workspace</h3>
            <p>
              Live balances, execution, and personalized portfolio intelligence require a connected
              Solana wallet. Nothing is fabricated.
            </p>
            <button type="button" className="pd-connect" onClick={() => void connect()}>
              Connect Wallet
            </button>
          </div>
        ) : null}

        {nav === 'mission' ? (
          <SectionErrorBoundary title="Mission Control">
            <MissionControlPanel
              onOpenFeed={() => setDeskNav('feed')}
              onOpenMarket={() => setDeskNav('market')}
              onOpenDesk={(desk) => setDeskNav(desk)}
              onOpenCoach={() => {
                // Coach lives in the aside rail — keep Mission Control and scroll aside into view.
                const aside = document.querySelector('.pd-aside')
                aside?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
              }}
              onSelectToken={(row) => {
                const p = new URLSearchParams(searchParams.toString())
                p.set('mint', row.mint)
                router.replace(`?${p.toString()}`, { scroll: false })
              }}
              onSuggestion={() => setDeskNav('market')}
            />
          </SectionErrorBoundary>
        ) : null}

        {nav === 'market' || nav === 'screener' || nav === 'watchlist' ? (
          <SectionErrorBoundary title="Market Intelligence">
            <MarketIntelligencePanel
              initialTab={
                nav === 'watchlist' || marketTab === 'tracked'
                  ? 'tracked'
                  : marketTab === 'discovery'
                    ? 'discovery'
                    : 'analyst'
              }
              onSelectMint={(mint) => {
                const p = new URLSearchParams(searchParams.toString())
                p.set('mint', mint)
                p.set('nav', 'market')
                router.replace(`?${p.toString()}`, { scroll: false })
              }}
            />
          </SectionErrorBoundary>
        ) : null}

        {nav === 'trade' && isConnected ? (
          <SectionErrorBoundary title="Trading">
            <TradePanel initialMint={focusMint.length >= 32 ? focusMint : ''} />
          </SectionErrorBoundary>
        ) : null}

        {isConnected && holdingsQ.isError && nav === 'portfolio' ? (
          <div className="pd-panel" style={{ padding: 16, marginBottom: 16, color: 'var(--pd-negative)' }}>
            {(holdingsQ.error as Error)?.message || 'Holdings failed'}{' '}
            <button type="button" className="pd-connect" style={{ marginLeft: 8 }} onClick={() => void holdingsQ.refetch()}>
              Retry
            </button>
          </div>
        ) : null}

        {nav === 'portfolio' && isConnected ? (
          <>
            <SectionErrorBoundary title="Portfolio Health">
              <Hero
                data={holdingsQ.data}
                loading={holdingsQ.isLoading}
                spark={perfQ.data?.series ?? []}
                range={range}
                wallet={walletAddress}
              />
            </SectionErrorBoundary>
            <SectionErrorBoundary title="Balance history">
              <PerformanceChart
                series={perfQ.data?.series ?? []}
                loading={perfQ.isLoading}
                note={perfQ.data?.simplification}
              />
            </SectionErrorBoundary>
            <SectionErrorBoundary title="Holdings">
              <HoldingsTable
                holdings={holdingsQ.data?.holdings ?? []}
                loading={holdingsQ.isLoading}
                connected={isConnected}
              />
            </SectionErrorBoundary>
            {/* Phase 19.3 deferred:
                - Transfers: timeline_events has agent/alert/order rows, not wallet
                  transfer from/to/amount. Helius tx history is not wired for this desk.
                - Exchange Usage: no per-venue execution breakdown exists yet.
                Do not ship placeholder tables to match the reference. */}
            <SectionErrorBoundary title="Risk & Allocation">
              <Metrics data={holdingsQ.data} loading={holdingsQ.isLoading} />
            </SectionErrorBoundary>
            <SectionErrorBoundary title="Analytics">
              <AnalyticsPanel />
            </SectionErrorBoundary>
            <SectionErrorBoundary title="AI Recommendations">
              <AiReviewPanel />
            </SectionErrorBoundary>
            <div className="pd-page-head" style={{ marginTop: 8 }}>
              <div>
                <h1>Market context</h1>
                <p>Live feeds — independently cached, never fabricated.</p>
              </div>
            </div>
            <SectionErrorBoundary title="Market">
              <MarketFeeds />
            </SectionErrorBoundary>
          </>
        ) : null}

        {nav === 'automation' ? (
          <SectionErrorBoundary title="Automation">
            <AutomationPanel walletAddress={walletAddress} />
          </SectionErrorBoundary>
        ) : null}

        {nav === 'launchlab' ? (
          <SectionErrorBoundary title="LaunchLab">
            <LaunchLabPanel />
          </SectionErrorBoundary>
        ) : null}

        {nav === 'feed' || nav === 'alerts' ? (
          <SectionErrorBoundary title="Mission Feed">
            <MissionFeedPanel />
          </SectionErrorBoundary>
        ) : null}

        {nav === 'intelligence' || nav === 'employees' ? (
          <SectionErrorBoundary title="Intelligence Engine">
            <AiEmployeesPanel />
          </SectionErrorBoundary>
        ) : null}

        {nav === 'settings' ? (
          <SectionErrorBoundary title="Settings">
            <SettingsPanel onOpenIntelligence={() => setDeskNav('intelligence')} />
          </SectionErrorBoundary>
        ) : null}
      </main>

      <aside className="pd-aside">
        <SectionErrorBoundary title="Mission Feed">
          <div style={{ padding: '0 0 12px' }}>
            <div className="pd-panel-head" style={{ padding: '0 0 10px' }}>
              <h2 className="pd-section-label">Mission Feed</h2>
              <button type="button" className="pd-tab" onClick={() => setDeskNav('feed')}>
                Expand
              </button>
            </div>
            <MissionFeedPanel condensed limit={16} />
          </div>
        </SectionErrorBoundary>
        <SectionErrorBoundary title="AI Coach">
          <CoachPanel />
        </SectionErrorBoundary>
      </aside>
    </div>
  )
}
