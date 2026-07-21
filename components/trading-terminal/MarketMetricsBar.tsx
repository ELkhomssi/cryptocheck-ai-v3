'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MarketStat } from '@/lib/trading-terminal/market-stats'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import { useTerminalFocus } from './TerminalFocusProvider'

function Sparkline({ points, tone }: { points: number[]; tone: MarketStat['tone'] }) {
  const series = points.length >= 2 ? points : [50, 50]
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min || 1
  const w = 64
  const h = 22
  const d = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w
      const y = h - ((v - min) / span) * (h - 2) - 1
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const stroke =
    tone === 'pos' ? 'var(--tit-pos)' : tone === 'neg' ? 'var(--tit-neg)' : 'var(--tit-text-2)'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="opacity-80">
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.25} />
    </svg>
  )
}

function FearGauge({ score, label }: { score: number; label: string }) {
  const pct = Math.max(0, Math.min(100, score)) / 100
  const r = 28
  const circ = Math.PI * r
  return (
    <div className="flex items-center gap-2">
      <svg width={64} height={36} viewBox="0 0 64 36" aria-hidden>
        <path
          d="M4 32 A28 28 0 0 1 60 32"
          fill="none"
          stroke="var(--tit-bg-3)"
          strokeWidth={6}
          strokeLinecap="round"
        />
        <path
          d="M4 32 A28 28 0 0 1 60 32"
          fill="none"
          stroke="var(--tit-caution)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
        />
      </svg>
      <div>
        <p className="tit-mono text-[0.95rem] font-semibold text-[var(--tit-text-0)]">{score}</p>
        <p className="text-[0.55rem] text-[var(--tit-text-1)]">{label}</p>
      </div>
    </div>
  )
}

function StatCard({ stat }: { stat: MarketStat }) {
  if (stat.loading) {
    return (
      <div className="flex min-w-[7.5rem] flex-1 flex-col justify-center gap-1 border-r border-[var(--tit-border)] px-3 py-2">
        <span className="tit-label">{stat.label}</span>
        <div className="tit-skeleton h-4 w-16" />
      </div>
    )
  }
  return (
    <div className="flex min-w-[7.5rem] flex-1 flex-col justify-center border-r border-[var(--tit-border)] px-3 py-2">
      <span className="tit-label">{stat.label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="tit-mono text-[0.95rem] font-semibold text-[var(--tit-text-0)]">
          {stat.value ?? '—'}
        </span>
        {stat.changePct ? (
          <span
            className={`tit-mono text-[0.55rem] ${
              stat.tone === 'pos'
                ? 'text-[var(--tit-pos)]'
                : stat.tone === 'neg'
                  ? 'text-[var(--tit-neg)]'
                  : 'text-[var(--tit-text-2)]'
            }`}
          >
            {stat.changePct.startsWith('-') || stat.changePct.startsWith('+')
              ? stat.changePct
              : `${stat.tone === 'neg' ? '' : '+'}${stat.changePct}`}
            <span className="sr-only">{stat.tone === 'pos' ? 'up' : stat.tone === 'neg' ? 'down' : ''}</span>
          </span>
        ) : null}
      </div>
      {!stat.value ? (
        <span className="tit-awaiting">{stat.awaitingCaption}</span>
      ) : (
        <div className="mt-0.5">
          <Sparkline points={stat.sparkline} tone={stat.tone} />
        </div>
      )}
    </div>
  )
}

export function MarketMetricsBar() {
  const { dataMode, solPriceUsd } = useTerminalFocus()
  const [liveSol, setLiveSol] = useState<number | null>(null)
  const [health, setHealth] = useState<'ok' | 'degraded' | 'unknown'>('unknown')

  useEffect(() => {
    if (dataMode === 'demo') return
    let cancelled = false
    const load = async () => {
      try {
        const [priceRes, healthRes] = await Promise.all([
          fetch('/api/sol-price', { cache: 'no-store' }),
          fetch('/api/health', { cache: 'no-store' }),
        ])
        if (cancelled) return
        if (priceRes.ok) {
          const body = (await priceRes.json()) as { price?: number; source?: string }
          if (typeof body.price === 'number' && body.source !== 'fallback') {
            setLiveSol(body.price)
          }
        }
        if (healthRes.ok) {
          const h = (await healthRes.json()) as { status?: string }
          setHealth(h.status === 'healthy' ? 'ok' : 'degraded')
        }
      } catch {
        if (!cancelled) setHealth('degraded')
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [dataMode])

  const snap = useMemo(
    () =>
      getTerminalSnapshot(dataMode, {
        solPriceUsd: liveSol ?? solPriceUsd,
        healthOk: health === 'ok',
      }),
    [dataMode, liveSol, solPriceUsd, health],
  )

  const stats = snap.marketStats.status === 'ready' ? snap.marketStats.data : []
  const fg = snap.fearGreed
  const statusOk = dataMode === 'demo' ? true : health === 'ok'

  return (
    <div
      className="tit-area-ribbon flex items-stretch overflow-x-auto border-b border-[var(--tit-border)] bg-[var(--tit-bg-0)]"
      style={{ minHeight: 'var(--tit-metrics)' }}
      aria-label="Market ribbon"
    >
      {stats.map((s) => (
        <StatCard key={s.id} stat={s} />
      ))}

      <div className="flex min-w-[9rem] flex-col justify-center border-r border-[var(--tit-border)] px-3 py-2">
        <span className="tit-label">Fear & Greed</span>
        {fg.status === 'ready' ? (
          <FearGauge score={fg.data.score} label={fg.data.label} />
        ) : (
          <>
            <span className="tit-mono text-[0.95rem] font-semibold text-[var(--tit-text-0)]">—</span>
            <span className="tit-awaiting">
              {fg.status === 'unavailable' ? fg.reason : 'Connecting…'}
            </span>
          </>
        )}
      </div>

      <div className="ml-auto flex min-w-[13rem] items-center gap-2.5 px-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            statusOk ? 'bg-[var(--tit-pos)]' : 'bg-[var(--tit-warn)]'
          }`}
          aria-hidden
        />
        <div>
          <p className="tit-label">Terminal Status</p>
          <p className="tit-mono text-[0.7rem] text-[var(--tit-text-0)]">
            {statusOk ? 'All Systems Operational' : 'Degraded'}
          </p>
        </div>
      </div>
    </div>
  )
}
