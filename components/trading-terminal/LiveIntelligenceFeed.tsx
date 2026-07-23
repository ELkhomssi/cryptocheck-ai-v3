'use client'

import { useEffect, useRef } from 'react'
import {
  formatFeedTime,
  type MarketFeedEvent,
  type MarketIntelSeverity,
} from '@/lib/trading-terminal/market-intelligence'

function severityClass(s: MarketIntelSeverity): string {
  if (s === 'CRITICAL') return 'bg-[var(--tit-neg)]/15 text-[var(--tit-neg)] border-[var(--tit-neg)]/35'
  if (s === 'WARNING') return 'bg-[var(--tit-warn)]/15 text-[var(--tit-warn)] border-[var(--tit-warn)]/35'
  return 'bg-[var(--tit-info)]/12 text-[var(--tit-info)] border-[var(--tit-info)]/30'
}

type Props = {
  events: MarketFeedEvent[]
  onSelectToken?: (mint: string, symbol: string) => void
  methodNote?: string
}

export function LiveIntelligenceFeed({ events, onSelectToken, methodNote }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Keep newest events visible at top — no auto-jump if user scrolled
  }, [events.length])

  return (
    <aside
      className="flex h-full min-h-0 flex-col overflow-hidden border-l border-[var(--tit-border)] bg-[var(--tit-bg-1)] backdrop-blur-xl"
      aria-label="Live intelligence feed"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--tit-border)] px-4 py-3">
        <div>
          <p className="tit-display text-[0.85rem] font-semibold tracking-tight">Live Intelligence</p>
          <p className="tit-mono text-[0.48rem] uppercase tracking-[0.12em] text-[var(--tit-text-2)]">
            Event stream
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-[var(--tit-pos)]/25 bg-[var(--tit-pos)]/8 px-2 py-0.5">
          <span className="tit-pulse" />
          <span className="tit-mono text-[0.55rem] font-semibold text-[var(--tit-pos)]">LIVE</span>
        </span>
      </div>

      <div ref={scrollerRef} className="tit-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {events.length === 0 ? (
          <p className="px-2 py-6 text-[0.72rem] text-[var(--tit-text-1)]">
            Intelligence stream connecting — no events yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {events.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={!e.mint}
                  onClick={() => e.mint && onSelectToken?.(e.mint, e.token)}
                  className="tit-intel-card w-full px-2.5 py-2.5 text-left disabled:cursor-default"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="tit-mono text-[0.52rem] text-[var(--tit-text-2)]">
                      {formatFeedTime(e.at)}
                    </span>
                    <span
                      className={`tit-mono rounded border px-1.5 py-px text-[0.48rem] font-bold uppercase tracking-wide ${severityClass(e.severity)}`}
                    >
                      {e.severity}
                    </span>
                    {e.sample ? <span className="tit-sample-tag">Sample</span> : null}
                    <span className="tit-mono ml-auto text-[0.68rem] font-bold text-[var(--tit-text-0)]">
                      {e.token}
                    </span>
                  </div>
                  <p className="text-[0.7rem] leading-snug text-[var(--tit-text-1)]">{e.description}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {methodNote ? (
        <p className="tit-compliance shrink-0 border-t border-[var(--tit-border)] px-3 py-2 text-center">
          {methodNote} · Informational only · NFA
        </p>
      ) : null}
    </aside>
  )
}
