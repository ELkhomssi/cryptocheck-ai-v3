'use client'

/**
 * HolderChart — Phase 4C (v2 only)
 *
 * Horizontal stacked bar chart showing the top 10 holders as
 * segments. No chart library — just SVG rects + a custom tooltip
 * tracked by hover/focus state. A final "Others" segment fills
 * the remainder up to 100%.
 */

import { useState } from 'react'
import type {
  TokenIntelligenceReport,
  TopHolderRow,
} from '@/lib/types/intelligence'
import { Card } from '../primitives/Card'
import { formatPercent, shortMint } from '../primitives/format'

type Segment = {
  key: string
  pct: number
  label: string
  sublabel: string
  color: string
  isOthers?: boolean
}

const TOP_COLORS = [
  '#00d4aa',
  '#00b8d9',
  '#58a6ff',
  '#a371f7',
  '#ff6ea5',
  '#ffa502',
  '#ffd166',
  '#8ce7c0',
  '#7aa2f7',
  '#b794f6',
] as const

function buildSegments(rows: TopHolderRow[]): Segment[] {
  const top = rows.slice(0, 10)
  const totalTop = top.reduce((s, r) => s + (Number.isFinite(r.pct) ? r.pct : 0), 0)
  const others = Math.max(0, 100 - totalTop)
  const segs: Segment[] = top.map((r, i) => ({
    key: `${r.address}-${i}`,
    pct: r.pct,
    label: shortMint(r.address, 4, 4),
    sublabel: r.isLp ? 'LP pool' : r.isContract ? 'Program / contract' : 'Wallet',
    color: TOP_COLORS[i % TOP_COLORS.length],
  }))
  if (others > 0) {
    segs.push({
      key: 'others',
      pct: others,
      label: 'Others',
      sublabel: 'Remaining supply',
      color: 'rgba(255,255,255,0.08)',
      isOthers: true,
    })
  }
  return segs
}

export function HolderChart({
  report,
}: {
  report: TokenIntelligenceReport
}) {
  const rows = report.topHolders ?? []
  const [active, setActive] = useState<string | null>(null)

  if (rows.length === 0) {
    return (
      <Card className="p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Holder distribution
        </div>
        <p className="mt-4 font-mono text-xs text-slate-500">
          No holder data available.
        </p>
      </Card>
    )
  }

  const segments = buildSegments(rows)
  const concentration = report.top10Concentration

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Holder distribution
        </div>
        {concentration != null ? (
          <div className="font-mono text-[10px] text-slate-500">
            Top 10 ·{' '}
            <span className="text-slate-300">
              {formatPercent(concentration)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Stacked bar */}
      <svg
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="mt-4 h-3 w-full overflow-visible rounded-md"
        role="img"
        aria-label={`Top ${rows.length} holders, concentration ${formatPercent(concentration)}`}
      >
        {(() => {
          let cursor = 0
          return segments.map((seg) => {
            const x = cursor
            cursor += seg.pct
            const isActive = active === seg.key
            return (
              <rect
                key={seg.key}
                x={x}
                y={0}
                width={seg.pct}
                height={10}
                fill={seg.color}
                opacity={isActive || active == null ? 1 : 0.35}
                onMouseEnter={() => setActive(seg.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(seg.key)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                role="button"
                aria-label={`${seg.label}, ${formatPercent(seg.pct)}`}
                className="cursor-pointer outline-none transition-opacity focus-visible:stroke-white focus-visible:stroke-[0.3]"
              />
            )
          })
        })()}
      </svg>

      {/* Active row details */}
      <div className="mt-4 min-h-[48px] rounded-md border border-white/5 bg-black/20 px-3 py-2 font-mono text-xs">
        {(() => {
          const seg = segments.find((s) => s.key === active) ?? segments[0]
          return (
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: seg.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-slate-200">{seg.label}</div>
                <div className="text-[10px] text-slate-500">{seg.sublabel}</div>
              </div>
              <div className="shrink-0 tabular-nums text-slate-100">
                {formatPercent(seg.pct)}
              </div>
            </div>
          )
        })()}
      </div>
    </Card>
  )
}
