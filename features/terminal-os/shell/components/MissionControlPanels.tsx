'use client'

/**
 * Mission Control reference panels — presentation only.
 * KERNEL: holdings, Decision, market overview, fear/greed API, alerts, tokens, health.
 * Never invent portfolio $, risk, opportunity, greed, funding, or news.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Decision } from '@cryptocheck/decision-contracts'
import { useMarketOverview, useTopTokens } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import { selectHeroDecision } from '@/features/ai-os/lib/gateway-round2'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useRailBadges } from '@/features/terminal-os/shell/hooks/useRailBadges'
import { summaryFromHoldings } from '@/features/terminal-os/portfolio-os/lib/summary-from-holdings'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import { PortfolioAllocationDonut } from '@/features/terminal-os/portfolio-os/components/PortfolioAllocationDonut'
import { QuickSwapCard } from '@/features/terminal-os/trading-workspace/components/QuickSwapCard'

function GaugeRing({
  value,
  max = 100,
  label,
  tone = 'orange',
}: {
  value: number | null
  max?: number
  label: string
  tone?: 'orange' | 'mint' | 'red' | 'muted'
}) {
  const pct = value == null || !Number.isFinite(value) ? null : Math.min(100, Math.max(0, (value / max) * 100))
  const r = 28
  const c = 2 * Math.PI * r
  const dash = pct == null ? c : c - (pct / 100) * c
  return (
    <div className="tos-mc-gauge" data-tone={tone}>
      <svg viewBox="0 0 72 72" className="tos-mc-gauge-svg" aria-hidden>
        <circle cx="36" cy="36" r={r} className="tos-mc-gauge-track" />
        <circle
          cx="36"
          cy="36"
          r={r}
          className="tos-mc-gauge-fill"
          style={{ strokeDasharray: `${c}`, strokeDashoffset: `${dash}` }}
        />
      </svg>
      <div className="tos-mc-gauge-label">
        <strong>{value != null && Number.isFinite(value) ? Math.round(value) : '—'}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

/**
 * Mission Control metric strip — Portfolio / Risk / 24h P&L / Alerts / Opportunity.
 * Risk + Opportunity from published Decision only; portfolio from holdings.
 */
export function MissionMetricsStrip() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const connected = useTerminalOsStore((s) => s.walletConnected)
  const chainFamily = useTerminalOsStore((s) => s.walletChainFamily)
  const rail = useRailBadges()

  const holdingsQ = useQuery({
    queryKey: ['tos', 'mc-holdings', wallet, chainFamily],
    enabled: Boolean(connected && wallet),
    queryFn: async () => {
      const qs = new URLSearchParams({ wallet: wallet! })
      if (chainFamily === 'evm') qs.set('chain', 'ethereum')
      const res = await fetch(`/api/portfolio/holdings?${qs}`, { cache: 'no-store' })
      if (!res.ok) return null
      return (await res.json()) as HoldingsResponse
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
  })

  const decisionQ = useQuery({
    queryKey: ['tos', 'mc-hero-decision', wallet],
    queryFn: async (): Promise<Decision | null> => {
      const qs = new URLSearchParams({ limit: '12' })
      if (wallet) qs.set('wallet', wallet)
      const res = await fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
      if (!res.ok) return null
      const body = (await res.json()) as { decisions?: Decision[] }
      return selectHeroDecision(body.decisions ?? [])
    },
    staleTime: 12_000,
    refetchInterval: 20_000,
  })

  const summary = holdingsQ.data ? summaryFromHoldings(holdingsQ.data) : null
  const decision = decisionQ.data
  const risk =
    decision && typeof decision.risk === 'number' && Number.isFinite(decision.risk)
      ? decision.risk
      : null
  const opportunity =
    decision && typeof decision.confidence === 'number' && Number.isFinite(decision.confidence)
      ? decision.confidence
      : null
  const alertCount = rail.alertBadge ?? 0

  return (
    <section className="tos-mc-metrics" data-tos-mc-metrics="true" aria-label="Mission metrics">
      <header className="tos-mc-section-head">
        <div>
          <h2>Mission Control</h2>
          <p>Real-time overview of your markets, risks, and opportunities.</p>
        </div>
        <span className="tos-desk-live" data-on={decision ? 'true' : 'false'}>
          {decision ? 'Decision live' : 'Awaiting Decision'}
        </span>
      </header>
      <div className="tos-mc-metrics-grid">
        <article className="tos-mc-metric">
          <span className="tos-mc-metric-label">Portfolio Value</span>
          {!connected ? (
            <strong className="tos-muted">Connect wallet</strong>
          ) : summary ? (
            <>
              <strong className="tos-num">{formatUsd(summary.totalAssetsUsd, true)}</strong>
              <span className="tos-mc-metric-sub">
                <Pct value={summary.pnl24hPct} /> 24h
              </span>
            </>
          ) : (
            <strong className="tos-muted">{holdingsQ.isLoading ? 'Loading…' : 'Not enough data yet'}</strong>
          )}
        </article>
        <article className="tos-mc-metric tos-mc-metric--gauge">
          <span className="tos-mc-metric-label">Risk Score</span>
          <GaugeRing
            value={risk}
            label={risk == null ? 'from Decision' : risk < 34 ? 'LOW RISK' : risk < 67 ? 'MEDIUM' : 'HIGH RISK'}
            tone={risk == null ? 'muted' : risk < 34 ? 'mint' : risk < 67 ? 'orange' : 'red'}
          />
        </article>
        <article className="tos-mc-metric">
          <span className="tos-mc-metric-label">24H P&amp;L</span>
          {summary ? (
            <>
              <strong className={`tos-num ${summary.pnl24hUsd >= 0 ? 'tos-pos' : 'tos-neg'}`}>
                {formatUsd(summary.pnl24hUsd, true)}
              </strong>
              <span className="tos-mc-metric-sub">
                <Pct value={summary.pnl24hPct} />
              </span>
            </>
          ) : (
            <strong className="tos-muted">—</strong>
          )}
        </article>
        <article className="tos-mc-metric">
          <span className="tos-mc-metric-label">Active Alerts</span>
          <strong className="tos-num">{connected ? alertCount : '—'}</strong>
          <span className="tos-mc-metric-sub">
            {connected ? 'Fired rules for this wallet' : 'Connect wallet'}
          </span>
        </article>
        <article className="tos-mc-metric tos-mc-metric--gauge">
          <span className="tos-mc-metric-label">Opportunity Score</span>
          <GaugeRing
            value={opportunity}
            label={
              opportunity == null
                ? 'from Decision'
                : opportunity >= 70
                  ? 'HIGH'
                  : opportunity >= 40
                    ? 'MODERATE'
                    : 'LOW'
            }
            tone={opportunity == null ? 'muted' : opportunity >= 70 ? 'mint' : 'orange'}
          />
        </article>
      </div>
    </section>
  )
}

type FearGreedPayload = {
  fearGreed: number | null
  fearGreedLabel: string | null
}

export function MissionMarketOverview() {
  const { data: overview, isLoading, isError } = useMarketOverview()
  const fngQ = useQuery({
    queryKey: ['tos', 'mc-fear-greed'],
    queryFn: async (): Promise<FearGreedPayload> => {
      const res = await fetch('/api/market/intelligence', { cache: 'no-store' })
      if (!res.ok) return { fearGreed: null, fearGreedLabel: null }
      const body = (await res.json()) as FearGreedPayload
      return {
        fearGreed: body.fearGreed ?? null,
        fearGreedLabel: body.fearGreedLabel ?? null,
      }
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  const tokensQ = useTopTokens('all')
  const rows = tokensQ.data ?? []
  const sorted = [...rows].sort((a, b) => (b.change24hPct ?? 0) - (a.change24hPct ?? 0))
  const gainers = sorted.filter((t) => (t.change24hPct ?? 0) > 0).slice(0, 3)
  const losers = [...sorted].reverse().filter((t) => (t.change24hPct ?? 0) < 0).slice(0, 3)
  const fng = fngQ.data?.fearGreed ?? null

  return (
    <section className="tos-mc-market" data-tos-mc-market="true" aria-label="Market overview">
      <header className="tos-mc-panel-head">
        <span>Market Overview</span>
        <span className="tos-desk-live" data-on={overview ? 'true' : 'false'}>
          {overview?.source ?? '—'}
        </span>
      </header>
      {isError ? (
        <p className="tos-desk-empty">Market overview unavailable</p>
      ) : isLoading && !overview ? (
        <p className="tos-desk-empty">Loading market…</p>
      ) : (
        <div className="tos-mc-market-body">
          <div className="tos-mc-sentiment">
            <span className="tos-mc-metric-label">Market Sentiment</span>
            <GaugeRing
              value={fng}
              label={fngQ.data?.fearGreedLabel ?? (fng == null ? 'unavailable' : 'Index')}
              tone={fng == null ? 'muted' : fng >= 55 ? 'mint' : fng <= 40 ? 'red' : 'orange'}
            />
          </div>
          <div className="tos-mc-gl">
            <div>
              <span className="tos-mc-metric-label">Top Gainers</span>
              <ul>
                {gainers.length === 0 ? (
                  <li className="tos-muted">Not enough data yet</li>
                ) : (
                  gainers.map((t) => (
                    <li key={`g-${t.id}`}>
                      <strong>{t.symbol}</strong>
                      <Pct value={t.change24hPct} />
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <span className="tos-mc-metric-label">Top Losers</span>
              <ul>
                {losers.length === 0 ? (
                  <li className="tos-muted">Not enough data yet</li>
                ) : (
                  losers.map((t) => (
                    <li key={`l-${t.id}`}>
                      <strong>{t.symbol}</strong>
                      <Pct value={t.change24hPct} />
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
          <div className="tos-mc-dom">
            <div>
              <span className="tos-mc-metric-label">Dominance</span>
              <p>
                BTC{' '}
                <strong className="tos-num">
                  {overview ? `${overview.btcDominancePct.toFixed(1)}%` : '—'}
                </strong>
              </p>
              <p className="tos-muted">ETH / SOL — not enough data yet</p>
            </div>
            <div>
              <span className="tos-mc-metric-label">Funding Rate (Avg.)</span>
              <p className="tos-muted">Unavailable — no funding feed wired</p>
            </div>
            <div>
              <span className="tos-mc-metric-label">Total Mkt Cap</span>
              <p className="tos-num">
                {overview ? formatUsd(overview.marketCapUsd, true) : '—'}
              </p>
              {overview ? (
                <span className="tos-mc-metric-sub">
                  <Pct value={overview.marketCapChange24hPct} />
                </span>
              ) : null}
            </div>
            <div>
              <span className="tos-mc-metric-label">24H Volume</span>
              <p className="tos-num">
                {overview ? formatUsd(overview.volume24hUsd, true) : '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export function MissionLiquidityPanel() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  return (
    <section className="tos-mc-liq" data-tos-mc-liq="true" aria-label="Liquidity analysis">
      <header className="tos-mc-panel-head">
        <span>Liquidity Analysis</span>
        <span className="tos-desk-live" data-on={focused ? 'true' : 'false'}>
          {focused?.symbol ?? 'Focus a token'}
        </span>
      </header>
      <p className="tos-desk-empty">
        {focused
          ? `Focused $${focused.symbol} — pool composition / LP lock need a liquidity breakdown feed (not fabricated). Chart AI Overlay shows liquidity layers when the intelligence-chart engine publishes them.`
          : 'Focus a token to bind liquidity analysis. No fabricated pool splits.'}
      </p>
    </section>
  )
}

export function MissionTradeSuite() {
  const [tab, setTab] = useState<'Quick Trade' | 'DCA' | 'TWAP' | 'Grid'>('Quick Trade')
  return (
    <section className="tos-mc-trade" data-tos-mc-trade="true" aria-label="Trade Like Me execution">
      <header className="tos-mc-panel-head">
        <span>Trade Like Me</span>
        <div className="tos-mc-tabs" role="tablist" aria-label="Execution mode">
          {(['Quick Trade', 'DCA', 'TWAP', 'Grid'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              className="tos-mc-tab"
              data-active={tab === t ? 'true' : 'false'}
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </header>
      {tab === 'Quick Trade' ? (
        <div className="tos-mc-trade-body" data-tos-mc-quick="true">
          <QuickSwapCard />
        </div>
      ) : (
        <p className="tos-desk-empty">
          {tab} engine not enabled in this build — Quick Trade uses the live risk-gated Jupiter path
          only. No simulated fills.
        </p>
      )}
    </section>
  )
}

export function MissionNewsAlerts() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const q = useQuery({
    queryKey: ['tos', 'mc-news-alerts', wallet],
    queryFn: async () => {
      const items: { id: string; title: string; body: string; at: string }[] = []
      if (wallet) {
        const res = await fetch(`/api/terminal-os/alerts?wallet=${encodeURIComponent(wallet)}`, {
          cache: 'no-store',
        })
        if (res.ok) {
          const body = (await res.json()) as {
            fired?: { id: string; summary: string; firedAt: string }[]
          }
          for (const f of body.fired ?? []) {
            items.push({
              id: f.id,
              title: 'Alert fired',
              body: f.summary,
              at: f.firedAt,
            })
          }
        }
      }
      const wRes = await fetch('/api/terminal-os/feed?resource=whales&limit=8', { cache: 'no-store' })
      if (wRes.ok) {
        const body = (await wRes.json()) as {
          items?: { id: string; assetSymbol: string; action: string; usdValue: number; occurredAt?: string }[]
        }
        for (const w of body.items ?? []) {
          items.push({
            id: `whale-${w.id}`,
            title: `${w.action} ${w.assetSymbol}`,
            body: `${formatUsd(w.usdValue, true)} · whale movement`,
            at: w.occurredAt ?? new Date().toISOString(),
          })
        }
      }
      return items.slice(0, 8)
    },
    staleTime: 20_000,
    refetchInterval: 40_000,
  })

  return (
    <section className="tos-mc-news" data-tos-mc-news="true" aria-label="News and alerts">
      <header className="tos-mc-panel-head">
        <span>News &amp; Alerts</span>
        <span className="tos-desk-live" data-on={(q.data?.length ?? 0) > 0 ? 'true' : 'false'}>
          Live feed
        </span>
      </header>
      {!q.data?.length ? (
        <p className="tos-desk-empty">
          No fired alerts or whale events yet — headline news API not wired (no fabricated stories).
        </p>
      ) : (
        <ul className="tos-mc-news-list">
          {q.data.map((n) => (
            <li key={n.id}>
              <strong>{n.title}</strong>
              <span>{n.body}</span>
              <time dateTime={n.at}>{new Date(n.at).toLocaleTimeString()}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function MissionAllocationPanel() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const connected = useTerminalOsStore((s) => s.walletConnected)
  const chainFamily = useTerminalOsStore((s) => s.walletChainFamily)
  const holdingsQ = useQuery({
    queryKey: ['tos', 'mc-alloc', wallet, chainFamily],
    enabled: Boolean(connected && wallet),
    queryFn: async () => {
      const qs = new URLSearchParams({ wallet: wallet! })
      if (chainFamily === 'evm') qs.set('chain', 'ethereum')
      const res = await fetch(`/api/portfolio/holdings?${qs}`, { cache: 'no-store' })
      if (!res.ok) return null
      return (await res.json()) as HoldingsResponse
    },
    staleTime: 20_000,
  })

  return (
    <section className="tos-mc-alloc" data-tos-mc-alloc="true" aria-label="Portfolio allocation">
      <header className="tos-mc-panel-head">
        <span>Portfolio Allocation</span>
      </header>
      {!connected ? (
        <p className="tos-desk-empty">Connect a wallet to map allocation.</p>
      ) : !holdingsQ.data ? (
        <p className="tos-desk-empty">{holdingsQ.isLoading ? 'Loading…' : 'Not enough data yet'}</p>
      ) : (
        <PortfolioAllocationDonut
          holdings={holdingsQ.data.holdings}
          totalValueUsd={holdingsQ.data.totalValueUsd}
        />
      )}
    </section>
  )
}

export function MissionFooterStatus() {
  const rail = useRailBadges()
  const ok = rail.health.status === 'healthy'
  const now = new Date()
  return (
    <footer className="tos-mc-footer" data-tos-mc-footer="true" aria-label="System status bar">
      <ul>
        <li data-ok={ok ? 'true' : 'false'}>
          <span>AI Engine</span>
          <strong>{ok ? 'Operational' : rail.health.label}</strong>
        </li>
        <li data-ok={ok ? 'true' : 'false'}>
          <span>Data Feed</span>
          <strong>{rail.health.total > 0 ? `${rail.health.ok}/${rail.health.total}` : '—'}</strong>
        </li>
        <li data-ok="true">
          <span>Blockchain</span>
          <strong>Multi-chain</strong>
        </li>
        <li data-ok={ok ? 'true' : 'false'}>
          <span>Security</span>
          <strong>Scan gateway</strong>
        </li>
        <li data-ok={ok ? 'true' : 'false'}>
          <span>Uptime</span>
          <strong>{ok ? 'Live' : 'Degraded'}</strong>
        </li>
      </ul>
      <div className="tos-mc-footer-right">
        <time dateTime={now.toISOString()}>
          Last Updated: {now.toLocaleTimeString('en-GB', { hour12: false })} (local)
        </time>
        <span className="tos-mc-live-pill" data-on={ok ? 'true' : 'false'}>
          Live
        </span>
      </div>
    </footer>
  )
}

export function MissionAiSignals() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)
  const q = useQuery({
    queryKey: ['tos', 'mc-signals', wallet],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: '8' })
      if (wallet) qs.set('wallet', wallet)
      const res = await fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
      if (!res.ok) return [] as Decision[]
      const body = (await res.json()) as { decisions?: Decision[] }
      return body.decisions ?? []
    },
    staleTime: 15_000,
    refetchInterval: 25_000,
  })
  const rows = (q.data ?? []).slice(0, 5)

  return (
    <section className="tos-mc-signals" data-tos-mc-signals="true" aria-label="AI Signals">
      <header className="tos-mc-panel-head">
        <span>AI Signals</span>
        <span className="tos-desk-live" data-on={rows.length > 0 ? 'true' : 'false'}>
          {rows.length ? `${rows.length} live` : 'Quiet'}
        </span>
      </header>
      {rows.length === 0 ? (
        <p className="tos-desk-empty">No published Decisions yet — signals appear when the engine ticks.</p>
      ) : (
        <ul className="tos-mc-signals-list">
          {rows.map((d) => {
            const sym = d.subject?.kind === 'token' ? d.subject.symbol : '—'
            const kind =
              d.action === 'BUY' ? 'Buy Signal' : d.action === 'SELL' || d.action === 'EXIT' ? 'Risk Alert' : 'Watch'
            return (
              <li key={d.id}>
                <button
                  type="button"
                  className="tos-mc-signal-btn"
                  onClick={() => {
                    if (d.subject?.kind === 'token') {
                      setFocused({
                        id: d.subject.address,
                        symbol: d.subject.symbol,
                        name: d.subject.symbol,
                        chain: (d.subject.chain as 'solana') || 'solana',
                        priceUsd: 0,
                      })
                    }
                  }}
                >
                  <strong>{kind}</strong>
                  <span>
                    {sym}/USDC · {Math.round(d.confidence ?? 0)}%
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
