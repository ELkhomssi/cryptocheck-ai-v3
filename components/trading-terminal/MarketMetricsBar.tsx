'use client'

import { useEffect, useState } from 'react'

type SolPricePayload = { price?: number; source?: string }

type MetricCell = {
  label: string
  value: string
  delta: string | null
  tone: 'pos' | 'neg' | 'neutral'
}

/**
 * Market ribbon — only real feeds. SOL from /api/sol-price.
 * Other cells stay honest "—" until wired to live sources (no fabricated sparklines).
 */
export function MarketMetricsBar() {
  const [sol, setSol] = useState<MetricCell>({
    label: 'SOL Price',
    value: '—',
    delta: null,
    tone: 'neutral',
  })
  const [health, setHealth] = useState<'ok' | 'degraded' | 'unknown'>('unknown')

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
            setSol({
              label: 'SOL Price',
              value: `$${body.price.toFixed(2)}`,
              delta: null,
              tone: 'neutral',
            })
          } else {
            setSol({ label: 'SOL Price', value: '—', delta: null, tone: 'neutral' })
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
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const cells: MetricCell[] = [
    { label: 'Market Cap', value: '—', delta: null, tone: 'neutral' },
    { label: '24H Volume', value: '—', delta: null, tone: 'neutral' },
    { label: 'BTC Dom.', value: '—', delta: null, tone: 'neutral' },
    sol,
    { label: 'Active Wallets', value: '—', delta: null, tone: 'neutral' },
  ]

  return (
    <div
      className="flex shrink-0 items-stretch gap-0 overflow-x-auto border-b border-[var(--tit-border)] bg-[var(--tit-bg-0)]"
      style={{ minHeight: 'var(--tit-metrics)' }}
    >
      {cells.map((c) => (
        <div
          key={c.label}
          className="flex min-w-[7.5rem] flex-col justify-center border-r border-[var(--tit-border)] px-3 py-1.5"
        >
          <span className="tit-label">{c.label}</span>
          <div className="flex items-baseline gap-1.5">
            <span className="tit-mono text-[0.8rem] font-semibold text-[var(--tit-text-0)]">
              {c.value}
            </span>
            {c.delta ? (
              <span
                className={`tit-mono text-[0.55rem] ${
                  c.tone === 'pos'
                    ? 'text-[var(--tit-pos)]'
                    : c.tone === 'neg'
                      ? 'text-[var(--tit-neg)]'
                      : 'text-[var(--tit-text-2)]'
                }`}
              >
                {c.delta}
              </span>
            ) : null}
          </div>
        </div>
      ))}

      <div className="flex min-w-[9rem] flex-col justify-center border-r border-[var(--tit-border)] px-3 py-1.5">
        <span className="tit-label">Fear & Greed</span>
        <span className="tit-mono text-[0.75rem] text-[var(--tit-text-2)]">Unavailable</span>
      </div>

      <div className="ml-auto flex min-w-[12rem] items-center gap-2 px-3">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            health === 'ok'
              ? 'bg-[var(--tit-pos)]'
              : health === 'degraded'
                ? 'bg-[var(--tit-warn)]'
                : 'bg-[var(--tit-text-2)]'
          }`}
        />
        <div>
          <p className="tit-label">Terminal Status</p>
          <p className="tit-mono text-[0.65rem] text-[var(--tit-text-0)]">
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
