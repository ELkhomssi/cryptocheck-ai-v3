'use client'

import Link from 'next/link'
import { Leaf } from 'lucide-react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { formatAge } from '@/lib/signals-dashboard/format'
import { ScoreRing } from './ScoreRing'
import { EmptyState } from './EmptyState'

type Props = {
  gems: UnifiedSignal[]
  loading: boolean
}

export function EarlyGemCards({ gems, loading }: Props) {
  return (
    <section id="early-gems" className="cc-panel overflow-hidden">
      <header className="flex items-center justify-between border-b border-[var(--cc-inner)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-[var(--cc-green)]" />
          <div>
            <p className="cc-label text-[var(--cc-hi)]">Early Gem Detector</p>
            <p className="text-[0.65rem] text-[var(--cc-lo)]">High potential tokens before they explode</p>
          </div>
        </div>
        <Link href="/dashboard/signals" className="text-xs text-[var(--cc-green)] hover:underline">
          View All
        </Link>
      </header>

      {loading ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="cc-panel-2 h-28 cc-shimmer" />
          ))}
        </div>
      ) : gems.length === 0 ? (
        <EmptyState
          title="No early gems yet"
          detail="New token signals under 48h appear here when the feed detects fresh opportunities."
          className="border-0 bg-transparent min-h-[8rem]"
        />
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {gems.map((g) => (
            <article key={g.id} className="cc-panel-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--cc-hi)]">{g.label}</p>
                  <p className="cc-mono mt-1 text-[0.62rem] text-[var(--cc-lo)]">Age {formatAge(g.msgTimestamp)}</p>
                </div>
                <ScoreRing score={g.scoreValue ?? 0} size={40} stroke={3} />
              </div>
              <dl className="cc-mono mt-3 grid grid-cols-2 gap-2 text-[0.58rem] text-[var(--cc-mid)]">
                <div>
                  <dt className="text-[var(--cc-lo)]">Mentions</dt>
                  <dd>{g.sourceCount ?? 1}</dd>
                </div>
                <div>
                  <dt className="text-[var(--cc-lo)]">Verdict</dt>
                  <dd className="uppercase">{g.verdict}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
