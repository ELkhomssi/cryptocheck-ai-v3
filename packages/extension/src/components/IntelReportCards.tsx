/**
 * Extension-local scan report cards (stub for dashboard IntelReportCardsView).
 * Renders TokenIntelligenceReport from POST /api/v1/intelligence/scan — no @/ imports.
 */

import type { RiskVerdict, TokenIntelligenceReport } from '../types'

const VERDICT_STYLES: Record<RiskVerdict, string> = {
  SAFE: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100',
  CAUTION: 'border-amber-500/35 bg-amber-500/10 text-amber-100',
  RISKY: 'border-orange-500/35 bg-orange-500/10 text-orange-100',
  DANGER: 'border-rose-500/35 bg-rose-500/10 text-rose-100',
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

type Props = {
  report: TokenIntelligenceReport
  className?: string
}

export function IntelReportCardsView({ report, className = '' }: Props) {
  const verdict = report.riskVerdict ?? 'CAUTION'
  const verdictClass = VERDICT_STYLES[verdict]
  const score = report.riskScore ?? null
  const signals = (report.riskSignals ?? []).slice(0, 6)

  return (
    <div className={className}>
      <div className={`rounded-2xl border p-4 ${verdictClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight text-slate-50">
              {report.symbol || '???'}
              <span className="ml-2 font-normal text-slate-400">{report.name || 'Unknown'}</span>
            </p>
            <p className="mt-1 break-all font-mono text-[0.65rem] text-slate-500">{report.mint}</p>
          </div>
          <div className="text-right">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Risk</p>
            <p className="text-2xl font-bold tabular-nums">{score != null ? score : '—'}</p>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide">{verdict}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Price', value: fmtUsd(report.price) },
          { label: '24h', value: fmtPct(report.priceChange24h) },
          { label: 'Liquidity', value: fmtUsd(report.liquidityUsd) },
          { label: 'Mkt cap', value: fmtUsd(report.marketCap) },
        ].map((cell) => (
          <div
            key={cell.label}
            className="rounded-xl border border-white/[0.07] bg-slate-950/60 px-3 py-2.5"
          >
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{cell.label}</p>
            <p className="mt-1 text-sm font-medium text-slate-100">{cell.value}</p>
          </div>
        ))}
      </div>

      {report.liquidityLock ? (
        <div className="mt-4 rounded-xl border border-white/[0.07] bg-slate-950/60 px-3 py-2.5 text-xs text-slate-300">
          <span className="font-semibold text-slate-400">LP: </span>
          {report.liquidityLock.status}
          {report.liquidityLock.reason ? ` — ${report.liquidityLock.reason}` : ''}
        </div>
      ) : null}

      {signals.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {signals.map((s) => (
            <li
              key={`${s.code}-${s.message}`}
              className="rounded-lg border border-white/[0.06] bg-slate-950/50 px-3 py-2 text-xs text-slate-300"
            >
              <span
                className={
                  s.severity === 'danger'
                    ? 'text-rose-300'
                    : s.severity === 'warn'
                      ? 'text-amber-300'
                      : 'text-slate-400'
                }
              >
                [{s.severity}]
              </span>{' '}
              {s.message}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-[0.6rem] text-slate-600">
        Scan {report.meta.scanId.slice(0, 8)}… · cache {report.meta.cacheAge}s
      </p>
    </div>
  )
}
