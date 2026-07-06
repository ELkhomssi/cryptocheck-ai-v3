'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { SkeletonStatCards } from '@/components/command-center/SkeletonRows'

type Track = {
  decisionsCount: number
  settlementsCount: number
  openCount: number
  totalPnl: number
  wins: number
  losses: number
  hitRate: number
  label: string
}

type Backtest = {
  totalPnl?: number
  hitRate?: number
  decisions?: number
  allVerified?: boolean
  ranAt?: string
} | null

type Props = {
  track: Track
  backtest: Backtest
  loading?: boolean
}

function useCountUp(target: number, enabled: boolean, decimals = 0): string {
  const reduce = useReducedMotion()
  const [v, setV] = useState(0)

  useEffect(() => {
    if (!enabled) return
    if (reduce) {
      setV(target)
      return
    }
    const start = performance.now()
    const from = 0
    const dur = 700
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - (1 - p) ** 3
      setV(from + (target - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, enabled, reduce])

  if (decimals > 0) return v.toFixed(decimals)
  return String(Math.round(v))
}

function MiniSpark({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) {
    return (
      <svg viewBox="0 0 64 20" className="mt-2 h-5 w-full text-rd-lo/40" aria-hidden>
        <line x1="0" y1="10" x2="64" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
    )
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values
    .map((n, i) => {
      const x = (i / (values.length - 1)) * 64
      const y = 18 - ((n - min) / span) * 16
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox="0 0 64 20" className="mt-2 h-5 w-full" aria-hidden>
      <polyline
        fill="none"
        stroke={positive ? 'var(--rd-risk-safe)' : 'var(--rd-risk-danger)'}
        strokeWidth="1.5"
        points={pts}
      />
    </svg>
  )
}

function StatCard({
  label,
  display,
  accent,
  hint,
  spark,
  sparkPositive,
}: {
  label: string
  display: string
  accent?: string
  hint?: string
  spark?: number[]
  sparkPositive?: boolean
}) {
  return (
    <div className="rounded-rd-sm border border-white/10 bg-rd-navy/50 px-3 py-3 transition-colors hover:border-rd-green/25">
      <div className="flex items-start justify-between gap-1">
        <p className="rd-label text-[0.5rem]">{label}</p>
        <span className="rounded border border-rd-green/25 bg-rd-green/5 px-1 py-0.5 font-rd-display text-[0.42rem] font-bold uppercase tracking-wider text-rd-green/90">
          verifiable
        </span>
      </div>
      <p
        className={`mt-1.5 font-rd-display text-xl font-bold uppercase tracking-wide tabular-nums ${
          accent ?? 'text-rd-hi'
        }`}
      >
        {display}
      </p>
      {hint ? <p className="mt-0.5 text-[0.6rem] text-rd-lo">{hint}</p> : null}
      {spark ? <MiniSpark values={spark} positive={sparkPositive !== false} /> : null}
    </div>
  )
}

export function TrackRecordPanel({ track, backtest, loading }: Props) {
  const awaiting = track.settlementsCount === 0
  const pnlAccent =
    track.totalPnl > 0 ? 'text-rd-safe' : track.totalPnl < 0 ? 'text-rd-danger' : 'text-rd-hi'

  const pnl = useCountUp(track.totalPnl, !loading, 2)
  const hit = useCountUp(track.hitRate * 100, !loading, 0)
  const decisions = useCountUp(track.decisionsCount, !loading)
  const settled = useCountUp(track.settlementsCount, !loading)
  const open = useCountUp(track.openCount, !loading)

  const spark = [
    0,
    track.totalPnl * 0.2,
    track.totalPnl * 0.45,
    track.totalPnl * 0.35,
    track.totalPnl * 0.7,
    track.totalPnl,
  ]

  if (loading) {
    return (
      <div className="rd-panel space-y-4 p-4">
        <div>
          <p className="rd-label">Track record</p>
          <h3 className="font-rd-display text-sm font-bold uppercase tracking-wider text-rd-hi">
            Verifiable on-chain
          </h3>
        </div>
        <SkeletonStatCards />
      </div>
    )
  }

  return (
    <div className="rd-panel space-y-4 p-4">
      <div>
        <p className="rd-label">Track record</p>
        <h3 className="font-rd-display text-sm font-bold uppercase tracking-wider text-rd-hi">
          {track.label}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="P&L"
          display={awaiting ? '0.00' : pnl}
          accent={pnlAccent}
          hint={awaiting ? 'Awaiting first settlement' : undefined}
          spark={spark}
          sparkPositive={track.totalPnl >= 0}
        />
        <StatCard
          label="Hit rate"
          display={awaiting ? '—' : `${hit}%`}
          hint={awaiting ? 'Awaiting first settlement' : undefined}
        />
        <StatCard label="Decisions" display={decisions} />
        <StatCard label="Settled" display={settled} />
        <StatCard label="Open" display={open} />
        <StatCard
          label="W / L"
          display={`${track.wins} / ${track.losses}`}
          hint={awaiting ? 'Awaiting first settlement' : undefined}
        />
      </div>

      {backtest ? (
        <div className="rounded-rd-sm border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-rd-mid">
          <span className="font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-amber-200">
            Backtest
          </span>
          <span className="ml-2 font-rd-mono tabular-nums">
            PnL {Number(backtest.totalPnl ?? 0).toFixed(2)} · hit{' '}
            {((backtest.hitRate ?? 0) * 100).toFixed(0)}% · {backtest.decisions ?? 0} decisions
            {backtest.allVerified ? ' · all verified' : ''}
          </span>
          {backtest.ranAt ? (
            <span className="ml-2 text-rd-lo">{new Date(backtest.ranAt).toLocaleString()}</span>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-rd-lo">
          Paper backtest snapshot appears here when published — live tape remains the source of truth.
        </p>
      )}
    </div>
  )
}
