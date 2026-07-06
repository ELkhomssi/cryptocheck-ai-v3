'use client'

import { useEffect, useState } from 'react'

type Props = {
  label: string
  value: number | null
  suffix?: string
  delta24h?: number
  loading?: boolean
  format?: (n: number) => string
}

function defaultFmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export function StatTile({ label, value, suffix, delta24h, loading, format = defaultFmt }: Props) {
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
    const from = 0
    const to = value
    let frame = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700)
      setDisplay(from + (to - from) * p)
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, loading])

  return (
    <div className="cc-panel-2 min-w-[7rem] flex-1 px-3 py-2.5">
      <p className="cc-label text-[0.52rem]">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-16 rounded cc-shimmer" aria-busy="true" />
      ) : (
        <p className="cc-mono mt-1 text-lg font-semibold text-[var(--cc-hi)]">
          {value == null ? '—' : format(display)}
          {suffix ? <span className="text-sm text-[var(--cc-lo)]">{suffix}</span> : null}
        </p>
      )}
      {typeof delta24h === 'number' && !loading ? (
        <p className="cc-mono mt-0.5 text-[0.58rem] text-[var(--cc-green)]">+{format(delta24h)} 24h</p>
      ) : null}
    </div>
  )
}
