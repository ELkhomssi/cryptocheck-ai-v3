'use client'

import Link from 'next/link'
import type { TickerAlert } from '@/lib/command-center/alerts'

export type AlertsTickerProps = {
  alerts: TickerAlert[]
}

const DOT: Record<TickerAlert['kind'], string> = {
  edge: 'bg-dash-orangeTx',
  verdict: 'bg-dash-amber',
  agent: 'bg-dash-sky',
  signal: 'bg-dash-green',
}

export function AlertsTicker({ alerts }: AlertsTickerProps) {
  const items = alerts.length > 0 ? [...alerts, ...alerts] : []

  return (
    <footer
      className="flex h-10 items-center border-t border-dash-hairline bg-dash-panel"
      aria-live="off"
    >
      <span className="ml-4 flex shrink-0 items-center gap-1.5 rounded-dash-pill bg-dash-greenDim px-2 py-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-dash-green">Alerts</span>
        <span className="font-dash-mono text-[11px] font-semibold tabular-nums text-dash-green">{alerts.length}</span>
      </span>

      <div className="relative mx-4 min-w-0 flex-1 overflow-hidden">
        {items.length === 0 ? (
          <p className="truncate text-xs text-dash-tlo">Awaiting pipeline events…</p>
        ) : (
          <div className="flex gap-8 whitespace-nowrap motion-safe:animate-ticker-slow motion-reduce:animate-none hover:[animation-play-state:paused]">
            {items.map((a, i) => (
              <span key={`${a.id}-${i}`} className="inline-flex items-center gap-2 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${DOT[a.kind]}`} aria-hidden />
                <span className="text-dash-tmid">{a.text}</span>
                <span className="font-dash-mono text-dash-tlo">· {a.ago}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/dashboard/alerts"
        className="mr-4 shrink-0 text-[11px] font-semibold text-dash-green transition-colors duration-150 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
      >
        View All Alerts
      </Link>
    </footer>
  )
}
