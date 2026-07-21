'use client'

/**
 * Bottom intelligence strip — Opportunity Radar, Portfolio, Risk Analysis, AI Alerts.
 * 15% viewport. No Telegram. No dashboard widgets.
 */

import { useMemo } from 'react'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import { useTerminalPortfolio } from './MiniPortfolioCard'
import { useTerminalFocus } from './TerminalFocusProvider'

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="tit-panel-flat flex min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--tit-border)] px-2 py-1">
        <p className="tit-label">{title}</p>
      </div>
      <div className="tit-scroll min-h-0 flex-1 overflow-auto p-2">{children}</div>
    </div>
  )
}

function riskBarColor(level: string): string {
  if (level === 'HIGH' || level === 'CRITICAL') return 'var(--tit-neg)'
  if (level === 'MEDIUM' || level === 'MED') return 'var(--tit-warn)'
  return 'var(--tit-pos)'
}

function riskWidth(level: string): string {
  if (level === 'HIGH' || level === 'CRITICAL') return '85%'
  if (level === 'MEDIUM' || level === 'MED') return '55%'
  return '28%'
}

function relativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

export function IntelligenceBottom() {
  const { dataMode, selectMint } = useTerminalFocus()
  const { brain } = useTerminalPortfolio()
  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])

  const opportunities =
    dataMode === 'demo' && snap.coach.status === 'ready'
      ? snap.coach.data.opportunities
      : []

  const portions =
    dataMode === 'demo' && snap.portions.status === 'ready'
      ? snap.portions.data
      : brain
        ? {
            totalUsd: brain.portions.totalUsd,
            pnl24hUsd: brain.portions.pnlUsd ?? 0,
            pnl24hPct: brain.portions.pnlPct ?? 0,
            legend: brain.portions.legend,
          }
        : null

  const riskAnalysis =
    dataMode === 'demo' && snap.coach.status === 'ready'
      ? snap.coach.data.riskAnalysis
      : brain
        ? {
            concentration:
              brain.riskExposure.band === 'CRITICAL' || brain.riskExposure.band === 'HIGH'
                ? 'HIGH'
                : brain.riskExposure.band === 'MEDIUM'
                  ? 'MEDIUM'
                  : 'LOW',
            liquidity: brain.threats.length > 0 ? 'HIGH' : 'LOW',
            correlation: 'MEDIUM' as const,
            volatility: 'MEDIUM' as const,
            smartMoney: 'LOW' as const,
          }
        : null

  const alerts =
    dataMode === 'demo' && snap.intel.status === 'ready'
      ? snap.intel.data.slice(0, 8)
      : []

  const donut = portions?.legend?.slice(0, 4) ?? []
  const gradient =
    donut.length > 0
      ? (() => {
          let acc = 0
          const colors = ['#22d3ee', '#22c55e', '#7c5cff', '#eab308']
          const stops: string[] = []
          for (let i = 0; i < donut.length; i++) {
            const start = acc
            acc += donut[i]!.pct
            stops.push(`${colors[i % colors.length]} ${start}% ${acc}%`)
          }
          return `conic-gradient(${stops.join(', ')})`
        })()
      : 'conic-gradient(var(--tit-bg-3) 0 100%)'

  return (
    <div className="grid h-full min-h-0 grid-cols-4 gap-1 p-1">
      <Panel title="Opportunity Radar">
        {opportunities.length === 0 ? (
          <p className="text-[0.65rem] text-[var(--tit-text-1)]">
            {dataMode === 'live' ? 'No qualifying opportunities yet.' : '—'}
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="tit-label text-[0.5rem]">
                <th className="pb-1 pr-1">Token</th>
                <th className="pb-1 pr-1">Conv</th>
                <th className="pb-1">Why Now</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((o) => {
                const tok =
                  snap.discover.status === 'ready'
                    ? snap.discover.data.find((d) => d.symbol === o.symbol)
                    : null
                return (
                  <tr key={o.symbol} className="border-t border-[var(--tit-border)]">
                    <td className="py-1 pr-1">
                      <button
                        type="button"
                        className="tit-mono text-[0.65rem] font-bold text-[var(--tit-accent-bright)]"
                        onClick={() => tok && selectMint(tok.mint, tok.symbol)}
                      >
                        {o.symbol}
                      </button>
                    </td>
                    <td className="tit-mono py-1 pr-1 text-[0.65rem] font-semibold text-[var(--tit-pos)]">
                      {o.conviction}
                    </td>
                    <td className="py-1 text-[0.6rem] text-[var(--tit-text-1)]">{o.reason}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Portfolio Overview">
        {!portions || portions.totalUsd <= 0 ? (
          <p className="text-[0.65rem] text-[var(--tit-text-1)]">
            {dataMode === 'live' ? 'Connect wallet to load book.' : '—'}
          </p>
        ) : (
          <div className="flex h-full items-center gap-3">
            <div
              className="h-16 w-16 shrink-0 rounded-full"
              style={{ background: gradient }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="tit-mono text-[0.9rem] font-bold text-[var(--tit-text-0)]">
                ${portions.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
              <p
                className={`tit-mono text-[0.65rem] ${
                  portions.pnl24hPct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                }`}
              >
                {portions.pnl24hPct >= 0 ? '+' : ''}
                {portions.pnl24hPct.toFixed(2)}%
                {dataMode === 'demo' ? ' 24h' : ''}
              </p>
              <ul className="mt-1 space-y-0.5">
                {donut.map((l) => (
                  <li key={l.name} className="flex justify-between text-[0.55rem]">
                    <span className="text-[var(--tit-text-1)]">{l.name}</span>
                    <span className="tit-mono">{l.pct.toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Risk Analysis">
        {!riskAnalysis ? (
          <p className="text-[0.65rem] text-[var(--tit-text-1)]">
            {dataMode === 'live' ? 'Connect wallet for risk gauges.' : '—'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {(
              [
                ['Concentration', riskAnalysis.concentration],
                ['Liquidity', riskAnalysis.liquidity],
                ['Correlation', riskAnalysis.correlation],
                ['Volatility', riskAnalysis.volatility],
                ['Smart Money', riskAnalysis.smartMoney],
              ] as const
            ).map(([label, level]) => (
              <li key={label}>
                <div className="mb-0.5 flex justify-between text-[0.55rem]">
                  <span className="text-[var(--tit-text-1)]">{label}</span>
                  <span
                    className="tit-mono font-bold"
                    style={{ color: riskBarColor(level) }}
                  >
                    {level}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded bg-[var(--tit-bg-3)]">
                  <div
                    className="h-full rounded"
                    style={{
                      width: riskWidth(level),
                      background: riskBarColor(level),
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Recent AI Alerts">
        {alerts.length === 0 ? (
          <p className="text-[0.65rem] text-[var(--tit-text-1)]">
            {dataMode === 'live' ? 'Awaiting on-chain intel.' : '—'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => a.mint && a.symbol && selectMint(a.mint, a.symbol)}
                >
                  <span className="block text-[0.65rem] font-medium text-[var(--tit-text-0)]">
                    {a.headline}
                  </span>
                  <span className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">
                    {relativeTime(a.at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
