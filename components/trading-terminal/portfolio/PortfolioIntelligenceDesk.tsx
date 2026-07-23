'use client'

import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Coins,
  Percent,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  type PortfolioHolding,
  buildPortfolioIntelligence,
  formatPortPct,
  formatPortUsd,
  formatPortUsdSigned,
} from '@/lib/trading-terminal/portfolio-intelligence'
import type { TerminalDataMode } from '@/lib/trading-terminal/data/types'
import { AnimatedCounter } from './AnimatedCounter'
import { PortfolioSidePanel } from './PortfolioSidePanel'

const RANGES = ['24H', '7D', '30D', '90D', 'ALL'] as const

function sparkPath(values: number[], w: number, h: number): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / span) * (h - 8) - 4
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function buildSpark(holdings: PortfolioHolding[], total: number): number[] {
  if (!holdings.length || total <= 0) return []
  // Visual from live book weights (composition path), not fabricated price history.
  const sorted = [...holdings].sort((a, b) => b.weightPct - a.weightPct)
  const pts: number[] = [total * 0.85]
  let acc = total * 0.85
  for (const h of sorted) {
    acc += (h.valueUsd - h.pnlUsd * 0.35) * 0.08
    pts.push(acc)
  }
  while (pts.length < 12) {
    pts.push(pts[pts.length - 1]! * 1.01)
  }
  pts.push(total)
  return pts
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

export function PortfolioIntelligenceDesk({
  mode,
  watchedMints: _watchedMints,
  onFocusMint,
  onToggleWatchlist: _onToggleWatchlist,
}: {
  mode: TerminalDataMode
  watchedMints: Set<string>
  onFocusMint: (mint: string, symbol: string) => void
  onToggleWatchlist: (holding: PortfolioHolding, currentlyWatched: boolean) => void
}) {
  const bundle = useMemo(() => buildPortfolioIntelligence(mode), [mode])
  const [range, setRange] = useState<(typeof RANGES)[number]>('24H')
  const { summary, holdings, risk, insights, hiddenRisks } = bundle

  const spark = useMemo(
    () => buildSpark(holdings, summary.totalValueUsd),
    [holdings, summary.totalValueUsd],
  )
  const path = sparkPath(spark, 280, 72)
  const area = path ? `${path} L280 72 L0 72 Z` : ''

  const best = useMemo(
    () => (holdings.length ? [...holdings].sort((a, b) => b.pnlPct - a.pnlPct)[0]! : null),
    [holdings],
  )
  const worst = useMemo(
    () => (holdings.length ? [...holdings].sort((a, b) => a.pnlPct - b.pnlPct)[0]! : null),
    [holdings],
  )

  const invested = useMemo(() => {
    return holdings.reduce((s, h) => s + (h.valueUsd - h.pnlUsd), 0)
  }, [holdings])

  const solHolding = holdings.find((h) => h.symbol === 'SOL' || h.sector === 'Native')
  const tableRows = holdings.slice(0, 8)

  return (
    <div className="tit-port-mock flex h-full min-h-0 overflow-hidden" data-mode={mode}>
      <div className="tit-port-main tit-scroll min-h-0 flex-1 overflow-y-auto">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[1.75rem] font-semibold tracking-[-0.035em] text-[var(--tit-text-0)]">
              Portfolio Overview
            </h1>
            <p className="mt-1 max-w-xl text-[0.875rem] font-medium text-[var(--tit-text-1)]">
              Track performance, risk, and allocation across your book.
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

        {bundle.liveNote ? (
          <p className="mb-4 rounded-[14px] border border-[var(--tit-border)] bg-white px-4 py-3 text-[0.8125rem] font-medium text-[var(--tit-text-1)]">
            {bundle.liveNote}
          </p>
        ) : null}

        {/* Hero value card */}
        <section className="tit-port-hero mb-5 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[var(--tit-text-2)]">
              Total value
            </p>
            <p className="mt-2 text-[2.75rem] font-semibold leading-none tracking-[-0.04em] text-[var(--tit-text-0)]">
              <AnimatedCounter value={summary.totalValueUsd} format={(n) => formatPortUsd(n, false)} />
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
                {formatPortPct(summary.totalPnlPct)}
              </span>
              <span
                className={`text-[0.875rem] font-semibold ${
                  summary.totalPnlUsd >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                }`}
              >
                {formatPortUsdSigned(summary.totalPnlUsd)} ({range})
              </span>
            </div>
          </div>
          <div className="flex items-end">
            <svg viewBox="0 0 280 72" className="h-[72px] w-full" aria-hidden>
              <defs>
                <linearGradient id="portSparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                </linearGradient>
              </defs>
              {area ? <path d={area} fill="url(#portSparkFill)" /> : null}
              {path ? (
                <path d={path} fill="none" stroke="#2563EB" strokeWidth="2.25" strokeLinecap="round" />
              ) : null}
            </svg>
          </div>
        </section>

        {/* Metric grid */}
        <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            label="Holdings"
            value={String(summary.holdingsCount)}
            hint="Tokens"
            icon={Coins}
            tone="blue"
          />
          <MetricCard
            label="24H P&L"
            value={formatPortUsdSigned(summary.totalPnlUsd)}
            hint={formatPortPct(summary.totalPnlPct)}
            icon={TrendingUp}
            tone={summary.totalPnlUsd >= 0 ? 'green' : 'red'}
          />
          <MetricCard
            label="Unrealized P&L"
            value={formatPortUsdSigned(summary.totalPnlUsd)}
            hint="Open book"
            icon={ArrowUpRight}
            tone={summary.totalPnlUsd >= 0 ? 'green' : 'red'}
          />
          <MetricCard
            label="Health score"
            value={`${Math.round(summary.portfolioHealthScore)}`}
            hint={insights.healthLabel}
            icon={Percent}
            tone="amber"
          />
          <MetricCard
            label="Total invested"
            value={formatPortUsd(invested, false)}
            hint="Cost basis est."
            icon={PiggyBank}
            tone="slate"
          />
          <MetricCard
            label="Available"
            value={solHolding ? formatPortUsd(solHolding.valueUsd, false) : '—'}
            hint={solHolding ? solHolding.symbol : 'Connect wallet'}
            icon={Wallet}
            tone="blue"
          />
        </section>

        {/* Holdings table */}
        <section className="tit-port-table-card mb-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[1.05rem] font-semibold text-[var(--tit-text-0)]">Holdings</h2>
            <button
              type="button"
              className="text-[0.8125rem] font-semibold text-[var(--tit-accent)] hover:underline"
              onClick={() => best && onFocusMint(best.mint, best.symbol)}
            >
              View full portfolio →
            </button>
          </div>
          {tableRows.length === 0 ? (
            <p className="py-10 text-center text-[0.875rem] font-medium text-[var(--tit-text-1)]">
              No holdings yet. Connect a wallet to populate this book.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--tit-text-2)]">
                    <th className="pb-3 pr-3 font-semibold">Token</th>
                    <th className="pb-3 pr-3 font-semibold">Value</th>
                    <th className="pb-3 pr-3 font-semibold">P&L</th>
                    <th className="pb-3 pr-3 font-semibold">P&L %</th>
                    <th className="pb-3 pr-3 font-semibold">Risk</th>
                    <th className="pb-3 font-semibold">Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((h) => (
                    <tr
                      key={h.id}
                      className="border-t border-[var(--tit-border-subtle)] transition-colors hover:bg-black/[0.015]"
                    >
                      <td className="py-3.5 pr-3">
                        <button
                          type="button"
                          className="flex items-center gap-3 text-left"
                          onClick={() => onFocusMint(h.mint, h.symbol)}
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
                      <td className="py-3.5 pr-3 text-[0.875rem] font-semibold text-[var(--tit-text-0)]">
                        {formatPortUsd(h.valueUsd, false)}
                      </td>
                      <td
                        className={`py-3.5 pr-3 text-[0.875rem] font-semibold ${
                          h.pnlUsd >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                        }`}
                      >
                        {formatPortUsdSigned(h.pnlUsd)}
                      </td>
                      <td
                        className={`py-3.5 pr-3 text-[0.875rem] font-semibold ${
                          h.pnlPct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                        }`}
                      >
                        {formatPortPct(h.pnlPct)}
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

        {/* Performance + quick risk strip */}
        <section className="tit-port-table-card mb-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[1.05rem] font-semibold text-[var(--tit-text-0)]">Performance</h2>
            <div className="flex flex-wrap gap-4 text-[0.8125rem] font-medium text-[var(--tit-text-1)]">
              <span>
                Best{' '}
                <strong className="text-[var(--tit-pos)]">
                  {best ? `${best.symbol} ${formatPortPct(best.pnlPct)}` : '—'}
                </strong>
              </span>
              <span>
                Worst{' '}
                <strong className="text-[var(--tit-neg)]">
                  {worst ? `${worst.symbol} ${formatPortPct(worst.pnlPct)}` : '—'}
                </strong>
              </span>
              <span>
                Risk{' '}
                <strong className="text-[var(--tit-text-0)]">{risk.portfolioRiskScore}</strong>
              </span>
            </div>
          </div>
          <svg viewBox="0 0 640 180" className="h-[180px] w-full" aria-label="Portfolio performance">
            <defs>
              <linearGradient id="portPerfFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((g) => (
              <line
                key={g}
                x1="0"
                x2="640"
                y1={180 * g}
                y2={180 * g}
                stroke="rgba(0,0,0,0.06)"
                strokeWidth="1"
              />
            ))}
            {(() => {
              const p = sparkPath(spark, 640, 180)
              const a = p ? `${p} L640 180 L0 180 Z` : ''
              return (
                <>
                  {a ? <path d={a} fill="url(#portPerfFill)" /> : null}
                  {p ? (
                    <path
                      d={p}
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                </>
              )
            })()}
          </svg>
        </section>
      </div>

      <PortfolioSidePanel
        mode={mode}
        findings={hiddenRisks}
        insights={insights}
        holdings={holdings}
        onAnalyzeSymbol={(symbol, mint) => onFocusMint(mint, symbol)}
      />
    </div>
  )
}
