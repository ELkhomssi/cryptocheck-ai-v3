'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Coins,
  CreditCard,
  Percent,
  TrendingUp,
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
import { useTerminalFocus } from '../TerminalFocusProvider'
import { useTerminalPortfolio } from '../MiniPortfolioCard'
import { AnimatedCounter } from './AnimatedCounter'
import { GoldAreaChart } from './GoldAreaChart'
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
  hintTone,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Coins
  hintTone?: 'up' | 'down'
}) {
  return (
    <article className="tit-port-metric-card">
      <div className="mi tit-port-i-gold">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      </div>
      <div className="ml">{label}</div>
      <div className="mv tit-num">{value}</div>
      {hint ? (
        <div className={`ms tit-num${hintTone ? ` ${hintTone}` : ''}`}>{hint}</div>
      ) : null}
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

  const bundle = useMemo(
    () => buildLivePortfolioFromSummary(data?.summary ?? null, brain),
    [data?.summary, brain],
  )
  const { summary, holdings, risk, hiddenRisks } = bundle
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

  const closes = useMemo(() => {
    if (ohlcv.status !== 'ready') return []
    return ohlcv.candles.map((c) => c.close).filter((n) => Number.isFinite(n) && n > 0)
  }, [ohlcv])

  const vol24h = useMemo(() => {
    if (ohlcv.status !== 'ready') return null
    const sum = ohlcv.candles.reduce((s, c) => s + (c.volume || 0), 0)
    return sum > 0 ? sum : null
  }, [ohlcv])

  const seriesChangePct = useMemo(() => {
    if (closes.length < 2) return null
    const a = closes[0]!
    const b = closes[closes.length - 1]!
    if (!(a > 0)) return null
    return ((b - a) / a) * 100
  }, [closes])

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
    return [...holdings].sort((a, b) => b.valueUsd - a.valueUsd)
  }, [holdings])

  const best = useMemo(() => {
    if (!holdings.length) return null
    const withPnl = holdings.filter((h) => h.avgEntryPriceUsd != null)
    if (withPnl.length) return [...withPnl].sort((a, b) => b.pnlPct - a.pnlPct)[0]!
    return [...holdings].sort((a, b) => b.valueUsd - a.valueUsd)[0]!
  }, [holdings])

  const riskLabel =
    !holdings.length
      ? '—'
      : risk.portfolioRiskScore >= 70
        ? 'Elevated'
        : risk.portfolioRiskScore >= 40
          ? 'Moderate'
          : 'Low'

  const pnlPct =
    data?.summary?.totalPnlPct != null
      ? summary.totalPnlPct
      : seriesChangePct
  const pnlUsd =
    data?.summary?.totalPnlUsd != null
      ? summary.totalPnlUsd
      : pnlPct != null && summary.totalValueUsd > 0
        ? (summary.totalValueUsd * pnlPct) / (100 + pnlPct)
        : null
  const pnlUp = (pnlPct ?? 0) >= 0

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
          <div className="tit-port-connect-banner">
            <div>
              <div className="tit-port-eyebrow">WALLET</div>
              <p className="tit-port-connect-title">Connect a wallet to load live balances</p>
              <p className="tit-port-connect-sub">
                Holdings, prices, and risk scores come from your Solana wallet and live market feeds.
              </p>
            </div>
            <button type="button" onClick={() => void connect()} className="tit-connect-btn">
              Connect Wallet
            </button>
          </div>
        ) : null}

        {isConnected && error ? (
          <p className="tit-port-error">
            {error}{' '}
            <button type="button" className="underline" onClick={() => void reload()}>
              Retry
            </button>
          </p>
        ) : null}

        {/* Hero — picture 1 */}
        <section className="tit-port-hero">
          <div className="tit-port-hero-top">
            <div>
              <div className="tit-port-eyebrow">TOTAL PORTFOLIO VALUE</div>
              <div className="tit-port-hero-value tit-num">
                {loading && !data ? (
                  <span className="tit-port-skel" style={{ width: 220, height: 42 }} />
                ) : (
                  <AnimatedCounter
                    value={summary.totalValueUsd}
                    format={(n) => formatPortUsd(n, false)}
                  />
                )}
              </div>
              <div className="tit-port-hero-change">
                <span className={`tit-num ${pnlUp ? 'tit-port-badge-up' : 'tit-port-badge-down'}`}>
                  {pnlUp ? '▲' : '▼'}{' '}
                  {pnlPct != null ? formatPortPct(Math.abs(pnlPct)).replace('+', '') : '—'}
                </span>
                <span className="tit-port-hero-abs tit-num">
                  {pnlUsd != null
                    ? `${formatPortUsdSigned(pnlUsd)} (${range})`
                    : `— (${range})`}
                </span>
              </div>
            </div>
            <div className="tit-port-hero-stats">
              <div className="tit-port-hstat">
                <div className="l">24H VOL</div>
                <div className="v tit-num">
                  {vol24h != null ? formatPortUsd(vol24h, false) : '—'}
                </div>
              </div>
              <div className="tit-port-hstat">
                <div className="l">BEST ASSET</div>
                <div className="v tit-num" style={{ color: 'var(--tit-pos)' }}>
                  {best?.symbol ?? '—'}
                </div>
              </div>
              <div className="tit-port-hstat">
                <div className="l">RISK SCORE</div>
                <div className="v tit-num" style={{ color: 'var(--tit-accent-bright)' }}>
                  {riskLabel}
                </div>
              </div>
            </div>
          </div>
          <div className="tit-port-hero-chart">
            <GoldAreaChart values={closes} height={150} />
          </div>
        </section>

        <section className="tit-port-metrics">
          <MetricCard
            label="Holdings"
            value={String(summary.holdingsCount)}
            hint="Tokens"
            icon={Coins}
          />
          <MetricCard
            label="24H P&L"
            value={pnlUsd != null ? formatPortUsdSigned(pnlUsd) : '—'}
            hint={pnlPct != null ? formatPortPct(pnlPct) : '—'}
            icon={TrendingUp}
            hintTone={pnlUp ? 'up' : 'down'}
          />
          <MetricCard
            label="Unrealized P&L"
            value={
              data?.summary?.totalPnlUsd != null ? formatPortUsdSigned(summary.totalPnlUsd) : '—'
            }
            hint={
              data?.summary?.totalPnlPct != null
                ? formatPortPct(summary.totalPnlPct)
                : 'Open book'
            }
            icon={ArrowUpRight}
            hintTone={summary.totalPnlUsd >= 0 ? 'up' : 'down'}
          />
          <MetricCard label="Win Rate" value="—" hint="Last 30 trades" icon={Percent} />
          <MetricCard
            label="Total Invested"
            value={
              holdings.length && invested > 0 ? formatPortUsd(invested, false) : '—'
            }
            icon={Zap}
          />
          <MetricCard
            label="Available Balance"
            value={
              solHolding?.amount != null
                ? `${solHolding.amount.toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL`
                : '—'
            }
            hint={solHolding ? formatPortUsd(solHolding.valueUsd, false) : undefined}
            icon={CreditCard}
          />
        </section>

        {/* Holdings — picture 1 table */}
        <section className="tit-port-table-card">
          <div className="tit-port-panel-head">
            <h2>Holdings</h2>
            <a className="tit-port-panel-link" href="#performance">
              View full portfolio →
            </a>
          </div>

          {!isConnected ? (
            <p className="tit-port-table-empty">Connect wallet to populate holdings.</p>
          ) : loading && !holdings.length ? (
            <div className="tit-port-table-loading">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="tit-port-skel" style={{ height: 40, margin: '10px 18px' }} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="tit-port-table-empty">No holdings above dust threshold.</p>
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
                            className="tit-port-token-btn"
                            onClick={() => {
                              selectMint(h.mint, h.symbol)
                              onFocusMint(h.mint, h.symbol)
                            }}
                          >
                            <span
                              className="tit-port-tk-icon"
                              style={{ background: tone.bg, color: tone.color }}
                            >
                              {h.symbol.slice(0, 1)}
                            </span>
                            <span>
                              <span className="tit-port-tk-name">{h.symbol}</span>
                              <span className="tit-port-tk-sub">{h.name}</span>
                            </span>
                          </button>
                        </td>
                        <td className="num-col tit-num">
                          {h.amount != null
                            ? h.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })
                            : '—'}
                        </td>
                        <td className="num-col tit-num">{formatPortUsd(h.valueUsd, false)}</td>
                        <td
                          className={`num-col tit-num ${
                            h.avgEntryPriceUsd != null
                              ? up
                                ? 'pl-up'
                                : 'pl-down'
                              : ''
                          }`}
                        >
                          {h.avgEntryPriceUsd != null ? formatPortUsdSigned(h.pnlUsd) : '—'}
                        </td>
                        <td
                          className={`num-col tit-num ${
                            h.avgEntryPriceUsd != null
                              ? up
                                ? 'pl-up'
                                : 'pl-down'
                              : ''
                          }`}
                        >
                          {h.avgEntryPriceUsd != null ? formatPortPct(h.pnlPct) : '—'}
                        </td>
                        <td className="num-col tit-num dim">
                          {h.avgEntryPriceUsd != null
                            ? `$${h.avgEntryPriceUsd < 1 ? h.avgEntryPriceUsd.toPrecision(4) : h.avgEntryPriceUsd.toFixed(2)}`
                            : '—'}
                        </td>
                        <td className="num-col tit-num">
                          {h.currentPriceUsd != null
                            ? `$${h.currentPriceUsd < 1 ? h.currentPriceUsd.toPrecision(4) : h.currentPriceUsd.toFixed(2)}`
                            : '—'}
                        </td>
                        <td className="num-col tit-num">
                          <div className="tit-port-alloc">
                            <span className="tit-num">{h.weightPct.toFixed(1)}%</span>
                            <div className="tit-port-alloc-track">
                              <div
                                className="tit-port-alloc-fill"
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

        {/* Performance — gold area like mock */}
        <section className="tit-port-table-card" id="performance">
          <div className="tit-port-panel-head">
            <h2>Performance</h2>
            <span className="tit-port-panel-link" style={{ color: 'var(--tit-text-1)' }}>
              {chartSymbol}/USD · live · {range}
            </span>
          </div>
          <div className="tit-port-perf-body">
            <GoldAreaChart values={closes} height={240} />
            <div className="tit-port-axis-row">
              <span>{range}</span>
              <span>{chartSymbol}</span>
              <span>Live market series</span>
            </div>
          </div>
        </section>
      </div>

      <PortfolioSidePanel
        mode="live"
        findings={hiddenRisks}
        insights={bundle.insights}
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
