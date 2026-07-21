'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MarketStat } from '@/lib/trading-terminal/market-stats'
import { awaitingStat, loadingStat } from '@/lib/trading-terminal/market-stats'
import { flatBaseline, mockSparkline } from '@/lib/trading-terminal/mocks/market-sparklines.mock'

type SolPricePayload = { price?: number; source?: string }

function Sparkline({ points, tone }: { points: number[]; tone: MarketStat['tone'] }) {
  const series = points.length >= 2 ? points : flatBaseline()
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

function StatCard({ stat }: { stat: MarketStat }) {
  if (stat.loading) {
    return (
      <div className="flex min-w-[7.5rem] flex-1 flex-col justify-center gap-1 border-r border-[var(--tit-border)] px-3 py-2">
        <span className="tit-label">{stat.label}</span>
        <div className="tit-skeleton h-4 w-16" />
        <div className="tit-skeleton h-3 w-12" />
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
            {stat.changePct}
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

/**
 * Market ribbon — SOL + health from real APIs; other metrics awaiting feed.
 * Sparklines: MOCK_ONLY series when a value is present (SOL); flat baseline otherwise.
 */
export function MarketMetricsBar() {
  const [solPrice, setSolPrice] = useState<number | null>(null)
  const [health, setHealth] = useState<'ok' | 'degraded' | 'unknown'>('unknown')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [priceRes, healthRes] = await Promise.all([
          fetch('/api/sol-price', { cache: 'no-store' }),
          fetch('/api/health', { cache: 'no-store' }),
        ])
        if (cancelled) return
        if (priceRes.ok) {
          const body = (await priceRes.json()) as SolPricePayload
          if (typeof body.price === 'number' && body.source !== 'fallback') {
            setSolPrice(body.price)
          } else {
            setSolPrice(null)
          }
        }
        if (healthRes.ok) {
          const h = (await healthRes.json()) as { status?: string }
          setHealth(h.status === 'healthy' ? 'ok' : 'degraded')
        } else {
          setHealth('degraded')
        }
      } catch {
        if (!cancelled) setHealth('degraded')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const stats: MarketStat[] = useMemo(() => {
    const spark = mockSparkline(42)
    const sol: MarketStat = loading
      ? loadingStat('sol_price', 'SOL PRICE')
      : solPrice != null
        ? {
            id: 'sol_price',
            label: 'SOL PRICE',
            value: `$${solPrice.toFixed(2)}`,
            changePct: null,
            tone: 'neutral',
            sparkline: spark,
            awaitingCaption: 'awaiting feed',
            loading: false,
          }
        : awaitingStat('sol_price', 'SOL PRICE', flatBaseline())

    return [
      awaitingStat('market_cap', 'MARKET CAP', flatBaseline()),
      awaitingStat('volume_24h', '24H VOLUME', flatBaseline()),
      awaitingStat('btc_dominance', 'BTC DOMINANCE', flatBaseline()),
      sol,
      awaitingStat('active_wallets', 'ACTIVE WALLETS', flatBaseline()),
    ]
  }, [loading, solPrice])

  return (
    <div
      className="tit-area-ribbon flex items-stretch overflow-x-auto border-b border-[var(--tit-border)] bg-[var(--tit-bg-0)]"
      style={{ minHeight: 'var(--tit-metrics)' }}
      aria-label="Market ribbon"
    >
      {stats.map((s) => (
        <StatCard key={s.id} stat={s} />
      ))}

      <div className="flex min-w-[8.5rem] flex-col justify-center border-r border-[var(--tit-border)] px-3 py-2">
        <span className="tit-label">Fear & Greed</span>
        <span className="tit-mono text-[0.95rem] font-semibold text-[var(--tit-text-0)]">—</span>
        <span className="tit-awaiting">awaiting feed</span>
      </div>

      <div className="ml-auto flex min-w-[13rem] items-center gap-2.5 px-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            health === 'ok'
              ? 'bg-[var(--tit-pos)]'
              : health === 'degraded'
                ? 'bg-[var(--tit-warn)]'
                : 'bg-[var(--tit-text-2)]'
          }`}
          aria-hidden
        />
        <div>
          <p className="tit-label">Terminal Status</p>
          <p className="tit-mono text-[0.7rem] text-[var(--tit-text-0)]">
            {health === 'ok'
              ? 'All Systems Operational'
              : health === 'degraded'
                ? 'Degraded'
                : 'Checking…'}
          </p>
        </div>
      </div>
    </div>
  )
}
