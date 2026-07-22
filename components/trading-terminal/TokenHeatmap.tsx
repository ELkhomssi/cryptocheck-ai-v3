'use client'

import { useMemo, useState } from 'react'
import type { HeatmapCell } from '@/lib/trading-terminal/market-intelligence'

function riskFill(risk: HeatmapCell['risk']): string {
  if (risk === 'safe') return 'rgba(0,230,118,0.55)'
  if (risk === 'high') return 'rgba(255,82,82,0.6)'
  return 'rgba(255,200,87,0.55)'
}

function riskBorder(risk: HeatmapCell['risk']): string {
  if (risk === 'safe') return 'rgba(0,230,118,0.45)'
  if (risk === 'high') return 'rgba(255,82,82,0.5)'
  return 'rgba(255,200,87,0.45)'
}

function fmtUsd(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

type Props = {
  cells: HeatmapCell[]
  onSelect?: (mint: string, symbol: string) => void
  focusMint?: string
}

export function TokenHeatmap({ cells, onSelect, focusMint }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null)
  const hover = useMemo(() => cells.find((c) => c.id === hoverId) ?? null, [cells, hoverId])

  const sorted = useMemo(
    () => [...cells].sort((a, b) => b.weight - a.weight),
    [cells],
  )

  return (
    <section
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-[var(--tit-border)] bg-[rgba(5,7,10,0.55)]"
      aria-label="Token risk heatmap"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--tit-border)] px-4 py-2.5">
        <div>
          <p className="tit-display text-[0.9rem] font-semibold tracking-tight">Token Heatmap</p>
          <p className="tit-mono text-[0.48rem] uppercase tracking-[0.12em] text-[var(--tit-text-2)]">
            Active universe · risk-weighted
          </p>
        </div>
        <div className="flex items-center gap-3 tit-mono text-[0.52rem]">
          <span className="flex items-center gap-1.5 text-[var(--tit-pos)]">
            <span className="h-2 w-2 rounded-sm bg-[var(--tit-pos)]" /> Safe
          </span>
          <span className="flex items-center gap-1.5 text-[var(--tit-warn)]">
            <span className="h-2 w-2 rounded-sm bg-[var(--tit-warn)]" /> Medium
          </span>
          <span className="flex items-center gap-1.5 text-[var(--tit-neg)]">
            <span className="h-2 w-2 rounded-sm bg-[var(--tit-neg)]" /> High
          </span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 p-3">
        {sorted.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[0.75rem] text-[var(--tit-text-1)]">
            Heatmap awaiting token universe feed.
          </div>
        ) : (
          <div
            className="grid h-full min-h-[280px] gap-1.5"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
              gridAutoRows: 'minmax(72px, 1fr)',
            }}
          >
            {sorted.map((c) => {
              const active = c.mint === focusMint
              const span = Math.max(1, Math.round(c.weight / 2))
              return (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setHoverId(c.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onFocus={() => setHoverId(c.id)}
                  onBlur={() => setHoverId(null)}
                  onClick={() => onSelect?.(c.mint, c.symbol)}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-[10px] border p-2.5 text-left transition-all duration-[var(--tit-motion)] ${
                    active ? 'ring-2 ring-[var(--tit-accent)]/50' : ''
                  }`}
                  style={{
                    gridRow: span > 2 ? `span ${Math.min(span, 3)}` : undefined,
                    gridColumn: span > 3 ? 'span 2' : undefined,
                    background: `linear-gradient(160deg, ${riskFill(c.risk)} 0%, rgba(5,7,10,0.85) 70%)`,
                    borderColor: riskBorder(c.risk),
                    boxShadow:
                      hoverId === c.id
                        ? `0 0 28px ${riskFill(c.risk)}`
                        : '0 4px 20px rgba(0,0,0,0.25)',
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="tit-mono text-[0.85rem] font-bold text-white">{c.symbol}</span>
                    <span className="tit-mono text-[0.55rem] text-white/70">{c.riskScore}</span>
                  </div>
                  <div className="mt-auto">
                    <span
                      className={`tit-mono text-[0.65rem] font-semibold ${
                        c.changePct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                      }`}
                    >
                      {c.changePct >= 0 ? '+' : ''}
                      {c.changePct.toFixed(1)}%
                    </span>
                    {c.sample ? (
                      <span className="tit-sample-tag ml-1.5 !align-middle">Sample</span>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Hover research card */}
        {hover ? (
          <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-[240px] rounded-[12px] border border-[var(--tit-border)] bg-[rgba(11,17,24,0.92)] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
            <p className="tit-display text-[0.95rem] font-semibold text-[var(--tit-text-0)]">
              {hover.symbol}
            </p>
            <p className="tit-mono text-[0.55rem] text-[var(--tit-text-2)]">{hover.name}</p>
            <dl className="mt-2.5 space-y-1.5 tit-mono text-[0.68rem]">
              <div className="flex justify-between">
                <dt className="text-[var(--tit-text-2)]">Risk score</dt>
                <dd
                  className={
                    hover.risk === 'high'
                      ? 'text-[var(--tit-neg)]'
                      : hover.risk === 'safe'
                        ? 'text-[var(--tit-pos)]'
                        : 'text-[var(--tit-warn)]'
                  }
                >
                  {hover.riskScore}/100 · {hover.risk}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--tit-text-2)]">Liquidity</dt>
                <dd className="text-[var(--tit-text-0)]">{fmtUsd(hover.liquidityUsd)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--tit-text-2)]">Holders</dt>
                <dd className="text-[var(--tit-text-0)]">
                  {hover.holders != null ? hover.holders.toLocaleString() : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--tit-text-2)]">Volume</dt>
                <dd className="text-[var(--tit-text-0)]">{fmtUsd(hover.volumeUsd)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  )
}
