'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Coins,
  Percent,
  PiggyBank,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
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
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Wallet
  tone: 'blue' | 'green' | 'amber' | 'red' | 'slate'
}) {
  const toneCls =
    tone === 'green'
      ? 'bg-[rgba(22,163,74,0.1)] text-[var(--tit-pos)]'
      : tone === 'amber'
        ? 'bg-[rgba(217,119,6,0.1)] text-[var(--tit-warn)]'
        : tone === 'red'
          ? 'bg-[rgba(220,38,38,0.1)] text-[var(--tit-neg)]'
          : tone === 'blue'
            ? 'bg-[rgba(37,99,235,0.1)] text-[var(--tit-accent)]'
            : 'bg-black/[0.04] text-[var(--tit-text-1)]'

  return (
    <article className="tit-port-metric-card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-[0.75rem] font-semibold text-[var(--tit-text-1)]">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${toneCls}`}>
          <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
      </div>
      <p className="text-[1.25rem] font-semibold tracking-tight text-[var(--tit-text-0)]">{value}</p>
      {hint ? <p className="mt-1 text-[0.6875rem] font-medium text-[var(--tit-text-2)]">{hint}</p> : null}
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
  const worst = useMemo(
    () => (holdings.length ? [...holdings].sort((a, b) => a.pnlPct - b.pnlPct)[0]! : null),
    [holdings],
  )

  return (
    <div className="tit-port-mock flex h-full min-h-0 overflow-hidden" data-mode="live">
      <div className="tit-port-main tit-scroll min-h-0 flex-1 overflow-y-auto">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[1.75rem] font-semibold tracking-[-0.035em] text-[var(--tit-text-0)]">
              Portfolio Overview
            </h1>
            <p className="mt-1 max-w-xl text-[0.875rem] font-medium text-[var(--tit-text-1)]">
              Track your assets, positions and AI analytics in real time.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-[var(--tit-border)] bg-white p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-full px-3 py-1.5 text-[0.75rem] font-semibold transition-colors ${
                  range === r
                    ? 'bg-[var(--tit-accent)] text-white'
                    : 'text-[var(--tit-text-1)] hover:text-[var(--tit-text-0)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </header>

        {!isConnected ? (
          <div className="tit-port-hero mb-5 flex flex-col items-start gap-4 p-8">
            <p className="text-[1.125rem] font-semibold text-[var(--tit-text-0)]">
              Connect a wallet to load live balances
            </p>
            <p className="max-w-lg text-[0.875rem] font-medium text-[var(--tit-text-1)]">
              Holdings, prices, risk scores, and charts come from your connected Solana wallet and
              live market feeds. Nothing is fabricated.
            </p>
            <button
              type="button"
              onClick={() => void connect()}
              className="h-11 rounded-full bg-[var(--tit-accent)] px-6 text-[0.875rem] font-semibold text-white"
            >
              Connect wallet
            </button>
          </div>
        ) : null}

        {isConnected && error ? (
          <p className="mb-4 rounded-[18px] border border-[var(--tit-neg)]/30 bg-[rgba(220,38,38,0.06)] px-4 py-3 text-[0.8125rem] font-medium text-[var(--tit-neg)]">
            {error}{' '}
            <button type="button" className="underline" onClick={() => void reload()}>
              Retry
            </button>
          </p>
        ) : null}

        {/* Hero + live chart */}
        <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <div className="tit-port-hero">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[var(--tit-text-2)]">
              Total value
            </p>
            <p className="mt-2 text-[2.75rem] font-semibold leading-none tracking-[-0.04em] text-[var(--tit-text-0)]">
              {loading && !data ? (
                '…'
              ) : (
                <AnimatedCounter
                  value={summary.totalValueUsd}
                  format={(n) => formatPortUsd(n, false)}
                />
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 text-[0.9375rem] font-semibold ${
                  summary.totalPnlPct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                }`}
              >
                {summary.totalPnlPct >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {data?.summary?.totalPnlPct != null ? formatPortPct(summary.totalPnlPct) : '—'}
              </span>
              <span
                className={`text-[0.875rem] font-semibold ${
                  summary.totalPnlUsd >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                }`}
              >
                {data?.summary?.totalPnlUsd != null
                  ? `${formatPortUsdSigned(summary.totalPnlUsd)} P&L`
                  : 'P&L when entry basis is known'}
              </span>
            </div>
            <p className="mt-4 text-[0.75rem] font-medium text-[var(--tit-text-2)]">
              {bundle.methodNote}
              {data?.summary?.lastUpdatedAt
                ? ` · updated ${new Date(data.summary.lastUpdatedAt).toLocaleTimeString()}`
                : null}
            </p>
          </div>

          <div className="tit-port-table-card flex min-h-[280px] flex-col overflow-hidden !p-0">
            <div className="flex items-center justify-between border-b border-[var(--tit-border)] px-4 py-3">
              <div>
                <p className="text-[0.9375rem] font-semibold text-[var(--tit-text-0)]">
                  {chartSymbol}/USD
                </p>
                <p className="text-[0.6875rem] font-medium text-[var(--tit-text-2)]">
                  Live candles · DexScreener / GeckoTerminal · {tf}
                </p>
              </div>
              {ohlcv.status === 'ready' ? (
                <div className="text-right">
                  <p className="text-[1.125rem] font-semibold text-[var(--tit-text-0)]">
                    ${ohlcv.lastPrice < 1 ? ohlcv.lastPrice.toPrecision(4) : ohlcv.lastPrice.toFixed(2)}
                  </p>
                  <p
                    className={`text-[0.75rem] font-semibold ${
                      ohlcv.changePct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                    }`}
                  >
                    {ohlcv.changePct >= 0 ? '+' : ''}
                    {ohlcv.changePct.toFixed(2)}%
                  </p>
                </div>
              ) : null}
            </div>
            <div className="relative min-h-[220px] flex-1">
              {ohlcv.status === 'loading' ? (
                <div className="flex h-full items-center justify-center text-[0.8125rem] text-[var(--tit-text-2)]">
                  Loading live series…
                </div>
              ) : ohlcv.status === 'building' ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-[0.8125rem] text-[var(--tit-text-1)]">
                  {ohlcv.reason}
                </div>
              ) : ohlcv.status === 'unavailable' ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-[0.8125rem] text-[var(--tit-text-1)]">
                  {ohlcv.reason}
                </div>
              ) : (
                <CandlestickChart candles={ohlcv.candles} />
              )}
            </div>
          </div>
        </section>

        {/* KPI cards — real only */}
        <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            label="Holdings"
            value={String(summary.holdingsCount)}
            hint="Above dust"
            icon={Coins}
            tone="blue"
          />
          <MetricCard
            label="24H Profit"
            value={
              data?.summary?.totalPnlUsd != null ? formatPortUsdSigned(summary.totalPnlUsd) : '—'
            }
            hint={
              data?.summary?.totalPnlPct != null ? formatPortPct(summary.totalPnlPct) : 'Entry basis'
            }
            icon={TrendingUp}
            tone={summary.totalPnlUsd >= 0 ? 'green' : 'red'}
          />
          <MetricCard
            label="Unrealized PNL"
            value={
              data?.summary?.totalPnlUsd != null ? formatPortUsdSigned(summary.totalPnlUsd) : '—'
            }
            hint="Open book"
            icon={ArrowUpRight}
            tone={summary.totalPnlUsd >= 0 ? 'green' : 'red'}
          />
          <MetricCard
            label="Health score"
            value={holdings.length ? String(Math.round(summary.portfolioHealthScore)) : '—'}
            hint={insights.healthLabel}
            icon={Percent}
            tone="amber"
          />
          <MetricCard
            label="Total invested"
            value={holdings.length ? formatPortUsd(invested, false) : '—'}
            hint="Cost basis when known"
            icon={PiggyBank}
            tone="slate"
          />
          <MetricCard
            label="Available balance"
            value={solHolding ? formatPortUsd(solHolding.valueUsd, false) : '—'}
            hint={solHolding ? `${solHolding.amount?.toFixed?.(4) ?? ''} SOL` : 'SOL in wallet'}
            icon={Wallet}
            tone="blue"
          />
        </section>

        {/* Holdings table */}
        <section className="tit-port-table-card mb-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[1.05rem] font-semibold text-[var(--tit-text-0)]">Holdings</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--tit-text-2)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search holdings"
                  className="h-9 rounded-full border border-[var(--tit-border)] bg-[var(--tit-bg-1)] pl-9 pr-3 text-[0.75rem] font-medium outline-none"
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
                  className={`rounded-full px-3 py-1.5 text-[0.6875rem] font-semibold ${
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
            <p className="py-10 text-center text-[0.875rem] font-medium text-[var(--tit-text-1)]">
              Connect wallet to populate holdings.
            </p>
          ) : loading && !holdings.length ? (
            <p className="py-10 text-center text-[0.875rem] font-medium text-[var(--tit-text-1)]">
              Scanning wallet holdings…
            </p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-[0.875rem] font-medium text-[var(--tit-text-1)]">
              No holdings above dust threshold.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse">
                <thead>
                  <tr className="text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--tit-text-2)]">
                    <th className="pb-3 pr-3">Token</th>
                    <th className="pb-3 pr-3">Chain</th>
                    <th className="pb-3 pr-3">Amount</th>
                    <th className="pb-3 pr-3">Price</th>
                    <th className="pb-3 pr-3">Avg</th>
                    <th className="pb-3 pr-3">P&L</th>
                    <th className="pb-3 pr-3">Risk</th>
                    <th className="pb-3 pr-3">Value</th>
                    <th className="pb-3">Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => (
                    <tr
                      key={h.id}
                      className="border-t border-[var(--tit-border-subtle)] transition-colors hover:bg-black/[0.015]"
                    >
                      <td className="py-3.5 pr-3">
                        <button
                          type="button"
                          className="flex items-center gap-3 text-left"
                          onClick={() => {
                            selectMint(h.mint, h.symbol)
                            onFocusMint(h.mint, h.symbol)
                          }}
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(37,99,235,0.1)] text-[0.6875rem] font-bold text-[var(--tit-accent)]">
                            {h.symbol.slice(0, 2)}
                          </span>
                          <span>
                            <span className="block text-[0.875rem] font-semibold text-[var(--tit-text-0)]">
                              {h.symbol}
                            </span>
                            <span className="block text-[0.6875rem] font-medium text-[var(--tit-text-2)]">
                              {h.name}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="py-3.5 pr-3 text-[0.8125rem] font-medium text-[var(--tit-text-1)]">
                        {h.chain ?? 'Solana'}
                      </td>
                      <td className="py-3.5 pr-3 text-[0.8125rem] font-semibold text-[var(--tit-text-0)]">
                        {h.amount != null
                          ? h.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })
                          : '—'}
                      </td>
                      <td className="py-3.5 pr-3 text-[0.8125rem] font-semibold text-[var(--tit-text-0)]">
                        {h.currentPriceUsd != null
                          ? `$${h.currentPriceUsd < 1 ? h.currentPriceUsd.toPrecision(4) : h.currentPriceUsd.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="py-3.5 pr-3 text-[0.8125rem] font-medium text-[var(--tit-text-1)]">
                        {h.avgEntryPriceUsd != null
                          ? `$${h.avgEntryPriceUsd < 1 ? h.avgEntryPriceUsd.toPrecision(4) : h.avgEntryPriceUsd.toFixed(2)}`
                          : '—'}
                      </td>
                      <td
                        className={`py-3.5 pr-3 text-[0.8125rem] font-semibold ${
                          h.pnlUsd >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                        }`}
                      >
                        {h.avgEntryPriceUsd != null ? (
                          <>
                            {formatPortUsdSigned(h.pnlUsd)}
                            <span className="ml-1 text-[0.6875rem]">{formatPortPct(h.pnlPct)}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${
                            h.riskBand === 'high'
                              ? 'bg-[rgba(220,38,38,0.1)] text-[var(--tit-neg)]'
                              : h.riskBand === 'medium'
                                ? 'bg-[rgba(217,119,6,0.1)] text-[var(--tit-warn)]'
                                : 'bg-[rgba(22,163,74,0.1)] text-[var(--tit-pos)]'
                          }`}
                        >
                          {h.riskScore}
                        </span>
                      </td>
                      <td className="py-3.5 pr-3 text-[0.875rem] font-semibold text-[var(--tit-text-0)]">
                        {formatPortUsd(h.valueUsd, false)}
                      </td>
                      <td className="py-3.5">
                        <div className="flex min-w-[120px] items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                            <div
                              className="h-full rounded-full bg-[var(--tit-accent)]"
                              style={{ width: `${Math.min(100, Math.max(2, h.weightPct))}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-[0.75rem] font-semibold text-[var(--tit-text-1)]">
                            {h.weightPct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Performance — live token series for selected holding (honest labeling) */}
        <section className="tit-port-table-card mb-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[1.05rem] font-semibold text-[var(--tit-text-0)]">
                Market performance · {chartSymbol}
              </h2>
              <p className="text-[0.75rem] font-medium text-[var(--tit-text-2)]">
                Interactive live candles for the focused holding. Portfolio equity history appears
                when position basis is tracked over time.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-[0.8125rem] font-medium text-[var(--tit-text-1)]">
              <span>
                Best{' '}
                <strong className="text-[var(--tit-pos)]">
                  {best && best.avgEntryPriceUsd != null
                    ? `${best.symbol} ${formatPortPct(best.pnlPct)}`
                    : '—'}
                </strong>
              </span>
              <span>
                Worst{' '}
                <strong className="text-[var(--tit-neg)]">
                  {worst && worst.avgEntryPriceUsd != null
                    ? `${worst.symbol} ${formatPortPct(worst.pnlPct)}`
                    : '—'}
                </strong>
              </span>
              <span>
                Risk <strong className="text-[var(--tit-text-0)]">{risk.portfolioRiskScore || '—'}</strong>
              </span>
            </div>
          </div>
          <div className="relative h-[220px] overflow-hidden rounded-[14px] border border-[var(--tit-border)]">
            {ohlcv.status === 'ready' ? (
              <CandlestickChart candles={ohlcv.candles} />
            ) : (
              <div className="flex h-full items-center justify-center text-[0.8125rem] text-[var(--tit-text-1)]">
                {ohlcv.status === 'loading'
                  ? 'Loading…'
                  : ohlcv.status === 'unavailable' || ohlcv.status === 'building'
                    ? ohlcv.reason
                    : 'Awaiting market series'}
              </div>
            )}
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
