'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Coins,
  CreditCard,
  Percent,
  Search,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { SOL_MINT } from '@/lib/trading-terminal/constants'
import {
  type PortfolioHolding,
  buildLivePortfolioFromSummary,
  formatPortPct,
  formatPortUsd,
  formatPortUsdSigned,
} from '@/lib/trading-terminal/portfolio-intelligence'
import {
  fetchLiveOhlcv,
  type OhlcvResult,
} from '@/lib/trading-terminal/ohlcv-feed'
import type { ChartTimeframe } from '@/lib/trading-terminal/chart-engine'
import { CandlestickChart } from '../CandlestickChart'
import { useTerminalFocus } from '../TerminalFocusProvider'
import { useTerminalPortfolio } from '../MiniPortfolioCard'
import { AnimatedCounter } from './AnimatedCounter'
import { PortfolioSidePanel } from './PortfolioSidePanel'
import { useSolana } from '@/components/SolanaProvider'

const RANGES = ['24H', '7D', '30D', '90D', 'ALL'] as const

function rangeToTf(range: (typeof RANGES)[number]): ChartTimeframe {
  if (range === '24H') return '1H'
  if (range === '7D') return '4H'
  if (range === '30D') return '1D'
  if (range === '90D') return '1D'
  return '1D'
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  hintTone,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Wallet
  tone: 'gold' | 'green' | 'red' | 'chain'
  hintTone?: 'up' | 'down'
}) {
  const iconCls =
    tone === 'green'
      ? 'tit-port-i-green'
      : tone === 'red'
        ? 'tit-port-i-red'
        : tone === 'chain'
          ? 'tit-port-i-chain'
          : 'tit-port-i-gold'

  return (
    <article className="tit-port-metric-card">
      <div className={`mi ${iconCls}`}>
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      </div>
      <div className="ml">{label}</div>
      <div className="mv">{value}</div>
      {hint ? <div className={`ms${hintTone ? ` ${hintTone}` : ''}`}>{hint}</div> : null}
    </article>
  )
}

function useLiveChart(mint: string, symbol: string, tf: ChartTimeframe): OhlcvResult {
  const [live, setLive] = useState<OhlcvResult>({ status: 'loading' })
  useEffect(() => {
    if (!mint || mint.length < 32) {
      setLive({ status: 'unavailable', reason: 'Select a token with a live market pair.' })
      return
    }
    let cancelled = false
    setLive({ status: 'loading' })
    void fetchLiveOhlcv({ mint, symbol, timeframe: tf }).then((r) => {
      if (!cancelled) setLive(r)
    })
    const id = window.setInterval(() => {
      void fetchLiveOhlcv({ mint, symbol, timeframe: tf }).then((r) => {
        if (!cancelled) setLive(r)
      })
    }, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [mint, symbol, tf])
  return live
}

function tokenTone(symbol: string): { color: string; bg: string } {
  const s = symbol.toUpperCase()
  if (s === 'SOL') return { color: '#6E5FE0', bg: 'rgba(110,95,224,.12)' }
  if (s.includes('JUP') || s.includes('CAT')) return { color: '#1E9A63', bg: 'rgba(30,154,99,.12)' }
  if (s.includes('BONK') || s.includes('BNK')) return { color: '#8F6423', bg: 'rgba(169,120,46,.12)' }
  return { color: '#6E5FE0', bg: 'rgba(110,95,224,.12)' }
}

export function PortfolioIntelligenceDesk({
  mode: _mode,
  watchedMints: _watchedMints,
  onFocusMint,
  onToggleWatchlist: _onToggleWatchlist,
  signals = [],
}: {
  mode: 'demo' | 'live'
  watchedMints: Set<string>
  onFocusMint: (mint: string, symbol: string) => void
  onToggleWatchlist: (holding: PortfolioHolding, currentlyWatched: boolean) => void
  signals?: UnifiedSignal[]
}) {
  const { isConnected, connect } = useSolana()
  const { focusMint, focusSymbol, selectMint } = useTerminalFocus()
  const { data, brain, loading, error, reload } = useTerminalPortfolio()
  const [range, setRange] = useState<(typeof RANGES)[number]>('24H')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'value' | 'pnl' | 'risk' | 'alloc'>('value')

  const bundle = useMemo(
    () => buildLivePortfolioFromSummary(data?.summary ?? null, brain),
    [data?.summary, brain],
  )
  const { summary, holdings, risk, insights, hiddenRisks } = bundle
  const tf = rangeToTf(range)

  const chartMint =
    focusMint && focusMint.length >= 32
      ? focusMint
      : holdings[0]?.mint ?? SOL_MINT
  const chartSymbol =
    focusMint && focusMint.length >= 32
      ? focusSymbol || holdings.find((h) => h.mint === focusMint)?.symbol || 'TOKEN'
      : holdings[0]?.symbol ?? 'SOL'

  const ohlcv = useLiveChart(chartMint, chartSymbol, tf)

  const invested = useMemo(() => {
    return holdings.reduce((s, h) => {
      if (h.avgEntryPriceUsd != null && h.amount != null) {
        return s + h.avgEntryPriceUsd * h.amount
      }
      return s + Math.max(0, h.valueUsd - h.pnlUsd)
    }, 0)
  }, [holdings])

  const solHolding = holdings.find((h) => h.mint === SOL_MINT || h.symbol === 'SOL')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = holdings
    if (q) {
      list = list.filter(
        (h) =>
          h.symbol.toLowerCase().includes(q) ||
          h.name.toLowerCase().includes(q) ||
          h.mint.toLowerCase().includes(q),
      )
    }
    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sortKey === 'pnl') return b.pnlUsd - a.pnlUsd
      if (sortKey === 'risk') return b.riskScore - a.riskScore
      if (sortKey === 'alloc') return b.weightPct - a.weightPct
      return b.valueUsd - a.valueUsd
    })
    return sorted
  }, [holdings, query, sortKey])

  const best = useMemo(
    () => (holdings.length ? [...holdings].sort((a, b) => b.pnlPct - a.pnlPct)[0]! : null),
    [holdings],
  )

  const riskLabel =
    risk.portfolioRiskScore >= 70
      ? 'Elevated'
      : risk.portfolioRiskScore >= 40
        ? 'Moderate'
        : holdings.length
          ? 'Low'
          : '—'

  const pnlUp = summary.totalPnlPct >= 0

  return (
    <div className="tit-port-mock flex h-full min-h-0 overflow-hidden" data-mode="live">
      <div className="tit-port-main tit-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="tit-port-page-head">
          <div>
            <h1>Portfolio Overview</h1>
            <p>Track your assets, performance and analytics in real-time.</p>
          </div>
          <div className="tit-port-tabs">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`tit-port-tab${range === r ? ' is-active' : ''}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {!isConnected ? (
          <div className="tit-port-hero mb-4 !pb-6">
            <div className="tit-port-eyebrow">WALLET</div>
            <p className="text-[1.125rem] font-semibold text-[var(--tit-text-0)]">
              Connect a wallet to load live balances
            </p>
            <p className="mt-2 max-w-lg text-[12.5px] text-[var(--tit-text-2)]">
              Holdings, prices, risk scores, and charts come from your connected Solana wallet and
              live market feeds. Nothing is fabricated.
            </p>
            <button type="button" onClick={() => void connect()} className="tit-connect-btn mt-4">
              Connect wallet
            </button>
          </div>
        ) : null}

        {isConnected && error ? (
          <p className="mb-4 rounded-[6px] border border-[var(--tit-neg)]/30 bg-[var(--tit-down-bg)] px-4 py-3 text-[0.8125rem] font-medium text-[var(--tit-neg)]">
            {error}{' '}
            <button type="button" className="underline" onClick={() => void reload()}>
              Retry
            </button>
          </p>
        ) : null}

        {/* Hero — HTML fidelity */}
        <section className="tit-port-hero">
          <div className="tit-port-hero-top">
            <div>
              <div className="tit-port-eyebrow">TOTAL PORTFOLIO VALUE</div>
              <div className="tit-port-hero-value">
                {loading && !data ? (
                  '…'
                ) : (
                  <AnimatedCounter
                    value={summary.totalValueUsd}
                    format={(n) => formatPortUsd(n, false)}
                  />
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                <span className={pnlUp ? 'tit-port-badge-up' : 'tit-port-badge-down'}>
                  {pnlUp ? '▲' : '▼'}{' '}
                  {data?.summary?.totalPnlPct != null ? formatPortPct(Math.abs(summary.totalPnlPct)) : '—'}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[var(--tit-text-1)]">
                  {data?.summary?.totalPnlUsd != null
                    ? `${formatPortUsdSigned(summary.totalPnlUsd)} (${range})`
                    : `P&L when entry basis is known · ${range}`}
                </span>
              </div>
            </div>
            <div className="tit-port-hero-stats">
              <div className="tit-port-hstat">
                <div className="l">HOLDINGS</div>
                <div className="v">{summary.holdingsCount}</div>
              </div>
              <div className="tit-port-hstat">
                <div className="l">BEST ASSET</div>
                <div className="v" style={{ color: 'var(--tit-pos)' }}>
                  {best && best.avgEntryPriceUsd != null ? best.symbol : '—'}
                </div>
              </div>
              <div className="tit-port-hstat">
                <div className="l">RISK SCORE</div>
                <div className="v" style={{ color: 'var(--tit-accent-bright)' }}>
                  {riskLabel}
                </div>
              </div>
            </div>
          </div>
          <div className="tit-port-hero-chart">
            {ohlcv.status === 'ready' ? (
              <CandlestickChart candles={ohlcv.candles} />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-[var(--tit-text-2)]">
                {ohlcv.status === 'loading'
                  ? `Loading ${chartSymbol} series…`
                  : ohlcv.status === 'unavailable' || ohlcv.status === 'building'
                    ? ohlcv.reason
                    : 'Awaiting live market series'}
              </div>
            )}
          </div>
        </section>

        <section className="tit-port-metrics">
          <MetricCard
            label="Holdings"
            value={String(summary.holdingsCount)}
            hint="Tokens"
            icon={Coins}
            tone="gold"
          />
          <MetricCard
            label="24H P&L"
            value={
              data?.summary?.totalPnlUsd != null ? formatPortUsdSigned(summary.totalPnlUsd) : '—'
            }
            hint={
              data?.summary?.totalPnlPct != null ? formatPortPct(summary.totalPnlPct) : 'Entry basis'
            }
            icon={TrendingUp}
            tone={summary.totalPnlUsd >= 0 ? 'green' : 'red'}
            hintTone={summary.totalPnlUsd >= 0 ? 'up' : 'down'}
          />
          <MetricCard
            label="Unrealized P&L"
            value={
              data?.summary?.totalPnlUsd != null ? formatPortUsdSigned(summary.totalPnlUsd) : '—'
            }
            hint="Open book"
            icon={ArrowUpRight}
            tone={summary.totalPnlUsd >= 0 ? 'green' : 'red'}
            hintTone={summary.totalPnlUsd >= 0 ? 'up' : 'down'}
          />
          <MetricCard
            label="Health score"
            value={holdings.length ? String(Math.round(summary.portfolioHealthScore)) : '—'}
            hint={insights.healthLabel}
            icon={Percent}
            tone="gold"
          />
          <MetricCard
            label="Total Invested"
            value={holdings.length ? formatPortUsd(invested, false) : '—'}
            hint="Cost basis when known"
            icon={Zap}
            tone="chain"
          />
          <MetricCard
            label="Available Balance"
            value={
              solHolding?.amount != null
                ? `${solHolding.amount.toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL`
                : '—'
            }
            hint={solHolding ? formatPortUsd(solHolding.valueUsd, false) : 'SOL in wallet'}
            icon={CreditCard}
            tone="chain"
          />
        </section>

        {/* Holdings */}
        <section className="tit-port-table-card">
          <div className="tit-port-panel-head">
            <h2>Holdings</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--tit-text-2)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="h-8 rounded-[3px] border border-[var(--tit-border)] bg-[var(--tit-bg-3)] pl-8 pr-2 text-[12px] outline-none"
                />
              </div>
              {(
                [
                  ['value', 'Value'],
                  ['pnl', 'P&L'],
                  ['risk', 'Risk'],
                  ['alloc', 'Alloc'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSortKey(k)}
                  className={`rounded-[3px] px-2.5 py-1 text-[11px] font-semibold ${
                    sortKey === k
                      ? 'bg-[var(--tit-bg-3)] text-[var(--tit-text-0)]'
                      : 'text-[var(--tit-text-2)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!isConnected ? (
            <p className="px-4 py-10 text-center text-[13px] text-[var(--tit-text-1)]">
              Connect wallet to populate holdings.
            </p>
          ) : loading && !holdings.length ? (
            <p className="px-4 py-10 text-center text-[13px] text-[var(--tit-text-1)]">
              Scanning wallet holdings…
            </p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-[var(--tit-text-1)]">
              No holdings above dust threshold.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tit-port-holdings-table min-w-[960px]">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th className="num-col">Amount</th>
                    <th className="num-col">Value</th>
                    <th className="num-col">24H P&L</th>
                    <th className="num-col">P&L %</th>
                    <th className="num-col">Avg. Price</th>
                    <th className="num-col">Current Price</th>
                    <th className="num-col">Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => {
                    const tone = tokenTone(h.symbol)
                    const up = h.pnlUsd >= 0
                    return (
                      <tr key={h.id}>
                        <td>
                          <button
                            type="button"
                            className="flex items-center gap-2.5 text-left"
                            onClick={() => {
                              selectMint(h.mint, h.symbol)
                              onFocusMint(h.mint, h.symbol)
                            }}
                          >
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                              style={{ background: tone.bg, color: tone.color, fontFamily: 'var(--font-mono)' }}
                            >
                              {h.symbol.slice(0, 1)}
                            </span>
                            <span>
                              <span className="block text-[13px] font-semibold text-[var(--tit-text-0)]">
                                {h.symbol}
                              </span>
                              <span className="block text-[11px] text-[var(--tit-text-2)]">{h.name}</span>
                            </span>
                          </button>
                        </td>
                        <td className="num-col">
                          {h.amount != null
                            ? h.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })
                            : '—'}
                        </td>
                        <td className="num-col">{formatPortUsd(h.valueUsd, false)}</td>
                        <td
                          className={`num-col ${
                            h.avgEntryPriceUsd != null
                              ? up
                                ? 'text-[var(--tit-pos)]'
                                : 'text-[var(--tit-neg)]'
                              : 'text-[var(--tit-text-2)]'
                          }`}
                        >
                          {h.avgEntryPriceUsd != null ? formatPortUsdSigned(h.pnlUsd) : '—'}
                        </td>
                        <td
                          className={`num-col ${
                            h.avgEntryPriceUsd != null
                              ? up
                                ? 'text-[var(--tit-pos)]'
                                : 'text-[var(--tit-neg)]'
                              : 'text-[var(--tit-text-2)]'
                          }`}
                        >
                          {h.avgEntryPriceUsd != null ? formatPortPct(h.pnlPct) : '—'}
                        </td>
                        <td className="num-col text-[var(--tit-text-1)]">
                          {h.avgEntryPriceUsd != null
                            ? `$${h.avgEntryPriceUsd < 1 ? h.avgEntryPriceUsd.toPrecision(4) : h.avgEntryPriceUsd.toFixed(2)}`
                            : '—'}
                        </td>
                        <td className="num-col">
                          {h.currentPriceUsd != null
                            ? `$${h.currentPriceUsd < 1 ? h.currentPriceUsd.toPrecision(4) : h.currentPriceUsd.toFixed(2)}`
                            : '—'}
                        </td>
                        <td className="num-col">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[var(--tit-text-1)]">{h.weightPct.toFixed(1)}%</span>
                            <div className="h-1 w-14 overflow-hidden rounded-[2px] bg-[var(--tit-bg-3)]">
                              <div
                                className="h-full rounded-[2px] bg-[var(--tit-accent)]"
                                style={{ width: `${Math.min(100, Math.max(2, h.weightPct))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Performance */}
        <section className="tit-port-table-card">
          <div className="tit-port-panel-head">
            <h2>Performance</h2>
            <span className="tit-port-panel-link" style={{ color: 'var(--tit-text-1)' }}>
              {chartSymbol}/USD · live · {tf}
            </span>
          </div>
          <div className="tit-port-perf-body">
            <div className="relative h-[240px] overflow-hidden">
              {ohlcv.status === 'ready' ? (
                <CandlestickChart candles={ohlcv.candles} />
              ) : (
                <div className="flex h-full items-center justify-center text-[12.5px] text-[var(--tit-text-1)]">
                  {ohlcv.status === 'loading'
                    ? 'Loading…'
                    : ohlcv.status === 'unavailable' || ohlcv.status === 'building'
                      ? ohlcv.reason
                      : 'Awaiting market series'}
                </div>
              )}
            </div>
            <p className="mt-2 text-[10px] text-[var(--tit-text-2)]" style={{ fontFamily: 'var(--font-mono)' }}>
              Focused token candles — portfolio equity history when position basis is tracked over time.
            </p>
          </div>
        </section>
      </div>

      <PortfolioSidePanel
        mode="live"
        findings={hiddenRisks}
        insights={insights}
        holdings={holdings}
        signals={signals}
        onAnalyzeSymbol={(symbol, mint) => {
          selectMint(mint, symbol)
          onFocusMint(mint, symbol)
        }}
      />
    </div>
  )
}
