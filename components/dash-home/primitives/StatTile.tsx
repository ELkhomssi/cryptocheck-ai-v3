'use client'

import { useEffect, useState } from 'react'

export type StatTileProps = {
  label: string
  value: number | null
  delta?: number
  loading?: boolean
  format?: (n: number) => string
}

function defaultFmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export function StatTile({ label, value, delta, loading, format = defaultFmt }: StatTileProps) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value == null || loading) {
      setDisplay(0)
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setDisplay(value)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 500)
      setDisplay(value * p)
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, loading])

  return (
    <div className="flex min-w-[7rem] flex-1 flex-col px-4 py-3 first:pl-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-dash-tlo">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-20 animate-shimmer rounded bg-dash-panel2 bg-[length:200%_100%] bg-gradient-to-r from-dash-panel2 via-dash-greenDim to-dash-panel2" />
      ) : (
        <p className="font-dash-mono mt-1 text-[22px] font-semibold tabular-nums text-dash-thi">
          {value == null ? '—' : format(display)}
        </p>
      )}
      {typeof delta === 'number' && !loading ? (
        <p className="font-dash-mono mt-0.5 text-[10px] text-dash-green">+{format(delta)} 24h</p>
      ) : null}
    </div>
  )
}
