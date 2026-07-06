'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { TickerAlert } from '@/lib/command-center/alerts'

type Props = {
  alerts: TickerAlert[]
}

export function AlertsTicker({ alerts }: Props) {
  const [paused, setPaused] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = trackRef.current
    if (!el || paused || alerts.length === 0) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    let offset = 0
    let frame = 0
    const tick = () => {
      offset -= 0.4
      if (Math.abs(offset) > el.scrollWidth / 2) offset = 0
      el.style.transform = `translateX(${offset}px)`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused, alerts])

  const items = alerts.length > 0 ? [...alerts, ...alerts] : []

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-50 flex h-10 items-center border-t border-[var(--cc-hairline)] bg-[var(--cc-panel)] md:left-[240px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-label="Live alerts ticker"
    >
      <span className="ml-3 flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--cc-green-dim)] px-2 py-1">
        <span className="cc-label text-[0.48rem] text-[var(--cc-green)]">Alerts</span>
        <span className="cc-mono text-[0.58rem] font-bold text-[var(--cc-green)]">{alerts.length}</span>
      </span>

      <div className="relative mx-3 min-w-0 flex-1 overflow-hidden">
        {items.length === 0 ? (
          <p className="truncate text-xs text-[var(--cc-lo)]">Awaiting pipeline events…</p>
        ) : (
          <div ref={trackRef} className="flex gap-8 whitespace-nowrap will-change-transform">
            {items.map((a, i) => (
              <span key={`${a.id}-${i}`} className="text-xs text-[var(--cc-mid)]">
                <span className="text-[var(--cc-hi)]">{a.text}</span>
                <span className="cc-mono ml-2 text-[var(--cc-lo)]">{a.ago} ago</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/dashboard/alerts"
        className="mr-4 shrink-0 text-[0.62rem] font-semibold text-[var(--cc-green)] hover:underline"
      >
        View All Alerts
      </Link>
    </footer>
  )
}
