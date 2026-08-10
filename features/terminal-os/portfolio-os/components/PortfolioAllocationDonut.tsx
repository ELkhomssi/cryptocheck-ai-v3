'use client'

/**
 * Portfolio allocation donut — presentation only.
 * Kernel: Holding.allocationPct / valueUsd from Portfolio Intelligence.
 */

import type { Holding } from '@/types/portfolio-desk'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import {
  DONUT_COLORS,
  allocationSegments,
} from '@/features/terminal-os/portfolio-os/lib/allocation-segments'

export { allocationSegments, DONUT_COLORS }

export function PortfolioAllocationDonut({
  holdings,
  totalValueUsd,
}: {
  holdings: Holding[]
  totalValueUsd: number
}) {
  const segs = allocationSegments(holdings)
  if (segs.length === 0 || totalValueUsd <= 0) {
    return <p className="tos-desk-empty">Not enough data yet for allocation.</p>
  }

  let cursor = 0
  const stops = segs.map((s, i) => {
    const start = cursor
    cursor += s.pct
    const color = DONUT_COLORS[i % DONUT_COLORS.length]
    return `${color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`
  })

  return (
    <div className="tos-donut-wrap">
      <div
        className="tos-donut"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
        role="img"
        aria-label="Portfolio allocation"
      >
        <div className="tos-donut-hole">
          <span className="tos-num">{formatUsd(totalValueUsd, true)}</span>
          <span className="tos-muted">Total</span>
        </div>
      </div>
      <ul className="tos-donut-legend">
        {segs.map((s, i) => (
          <li key={s.mint}>
            <i style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} aria-hidden />
            <span>{s.symbol}</span>
            <strong className="tos-num">{s.pct.toFixed(1)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
