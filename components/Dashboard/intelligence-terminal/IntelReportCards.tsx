'use client'

import { AlertTriangle, CheckCircle2, MinusCircle, Shield, XCircle } from 'lucide-react'
import type { TokenIntelligenceReport } from '@/lib/types/intelligence'
import { useTerminal } from './TerminalProvider'

function formatUsdCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n === 0) return '$0'
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
  return `$${n.toPrecision(6)}`
}

function verdictAccent(v: string | null | undefined): { border: string; glow: string; text: string } {
  switch (v) {
    case 'SAFE':
      return {
        border: 'border-emerald-500/35',
        glow: 'shadow-[0_0_40px_-8px_rgba(16,185,129,0.35)]',
        text: 'text-emerald-300',
      }
    case 'CAUTION':
      return {
        border: 'border-amber-500/35',
        glow: 'shadow-[0_0_40px_-8px_rgba(245,158,11,0.25)]',
        text: 'text-amber-300',
      }
    case 'RISKY':
      return {
        border: 'border-orange-500/35',
        glow: 'shadow-[0_0_40px_-8px_rgba(249,115,22,0.25)]',
        text: 'text-orange-300',
      }
    case 'DANGER':
      return {
        border: 'border-rose-500/40',
        glow: 'shadow-[0_0_40px_-8px_rgba(244,63,94,0.3)]',
        text: 'text-rose-300',
      }
    default:
      return {
        border: 'border-slate-500/30',
        glow: '',
        text: 'text-slate-400',
      }
  }
}

type CheckState = 'pass' | 'fail' | 'neutral'

function CheckRow({ label, state, hint }: { label: string; state: CheckState; hint?: string }) {
  const icon =
    state === 'pass' ? (
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400/95" aria-hidden />
    ) : state === 'fail' ? (
      <XCircle className="h-4 w-4 shrink-0 text-rose-400/95" aria-hidden />
    ) : (
      <MinusCircle className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
    )
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-slate-950/40 px-3 py-2.5">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
    </div>
  )
}

function buildSecurityRows(report: TokenIntelligenceReport): Array<{ label: string; state: CheckState; hint?: string }> {
  const v1 = report.meta.keyTier === 'v1'
  const mint = report.mintAuthority
  const freeze = report.freezeAuthority
  const insiders = report.insiderFlags

  const rows: Array<{ label: string; state: CheckState; hint?: string }> = []

  if (mint != null) {
    rows.push({
      label: 'Mint authority renounced',
      state: mint.renounced ? 'pass' : 'fail',
      hint: mint.renounced ? 'No new tokens can be minted.' : 'Mint authority is still active.',
    })
  } else {
    rows.push({
      label: 'Mint authority renounced',
      state: 'neutral',
      hint: v1 ? 'Not exposed in v1 scan — use a v2 key for full authority view.' : 'Not reported for this scan.',
    })
  }

  if (freeze != null) {
    rows.push({
      label: 'Freeze authority renounced',
      state: freeze.renounced ? 'pass' : 'fail',
      hint: freeze.renounced ? 'Accounts cannot be frozen by authority.' : 'Freeze authority can still freeze wallets.',
    })
  } else {
    rows.push({
      label: 'Freeze authority renounced',
      state: 'neutral',
      hint: v1 ? 'Not exposed in v1 scan — use a v2 key for full authority view.' : 'Not reported for this scan.',
    })
  }

  const blacklistFail = insiders != null && insiders.length > 0
  rows.push({
    label: 'Insider / blacklist signals',
    state: blacklistFail ? 'fail' : 'pass',
    hint: blacklistFail
      ? `${insiders!.length} flagged address(es) — review risk signals.`
      : 'No insider flags on this scan.',
  })

  return rows
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-slate-950/45 px-4 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1.5 font-mono text-base font-medium tabular-nums text-slate-100">{value}</p>
    </div>
  )
}

export function IntelReportCards() {
  const { state } = useTerminal()
  const report = state.currentScan?.report
  if (!report) return null

  const accent = verdictAccent(report.riskVerdict)
  const score = report.riskScore
  const scoreLabel = score != null && Number.isFinite(score) ? Math.round(score) : '—'

  const securityRows = buildSecurityRows(report)

  return (
    <div className="mt-10 space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Latest report</h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1 — Intelligence header */}
        <div
          className={`flex flex-col justify-between rounded-xl border bg-slate-900/60 p-5 shadow-xl backdrop-blur-md ${accent.border} ${accent.glow} lg:min-h-[220px]`}
        >
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">Token</p>
            <h4 className="mt-2 truncate text-xl font-semibold tracking-tight text-slate-50">{report.name}</h4>
            <p className="mt-1 font-mono text-sm text-[#00d4aa]/90">{report.symbol}</p>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-white/[0.06] pt-5">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Verdict</p>
              <p className={`mt-1 text-4xl font-bold tracking-tight sm:text-5xl ${accent.text}`}>
                {report.riskVerdict ?? '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Risk score</p>
              <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-slate-100">{scoreLabel}</p>
              <p className="text-xs text-slate-500">0–100 scale</p>
            </div>
          </div>
        </div>

        {/* 2 — Market metrics */}
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 shadow-xl backdrop-blur-md lg:min-h-[220px]">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">Market</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">DexScreener-sourced snapshot</p>
          <div className="mt-5 space-y-3">
            <Metric label="Price (USD)" value={formatPrice(report.price)} />
            <Metric label="Liquidity" value={formatUsdCompact(report.liquidityUsd)} />
            <Metric label="Market cap" value={formatUsdCompact(report.marketCap)} />
          </div>
        </div>

        {/* 3 — Security */}
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 shadow-xl backdrop-blur-md lg:min-h-[220px]">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#00d4aa]/80" aria-hidden />
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">Security check</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">On-chain authority &amp; flag heuristics</p>
          <div className="mt-4 space-y-2">
            {securityRows.map((row) => (
              <CheckRow key={row.label} label={row.label} state={row.state} hint={row.hint} />
            ))}
          </div>
          {report.riskSignals != null && report.riskSignals.length > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
              <p className="flex items-center gap-2 text-xs font-medium text-amber-200/95">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {report.riskSignals.length} risk signal(s) in model
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
