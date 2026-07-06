'use client'

import Link from 'next/link'
import { Gem } from 'lucide-react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { formatAge } from '@/lib/signals-dashboard/format'
import { ScoreRing } from './primitives/ScoreRing'
import { SectionHeader } from './primitives/SectionHeader'
import { SkeletonBlock } from './primitives/SkeletonBlock'

export type GemCardProps = {
  signal: UnifiedSignal
}

export function GemCard({ signal }: GemCardProps) {
  return (
    <article className="rounded-dash-inner border border-dash-innerline bg-dash-panel2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-dash-greenDeep text-xs font-bold text-dash-green">
            {(signal.tokenSymbol ?? signal.label).slice(0, 1)}
          </span>
          <p className="text-[13px] font-semibold text-dash-thi">{signal.label}</p>
        </div>
        <ScoreRing value={signal.scoreValue ?? 0} size={36} stroke={3} />
      </div>
      <dl className="mt-3 grid grid-cols-4 gap-2">
        <MiniCol label="Age" value={formatAge(signal.msgTimestamp)} />
        <MiniCol label="Mcap" value="—" />
        <MiniCol label="Liquidity" value="—" />
        <MiniCol label="Score" value={signal.scoreValue != null ? String(Math.round(signal.scoreValue)) : '—'} />
      </dl>
    </article>
  )
}

function MiniCol({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-dash-tlo">{label}</dt>
      <dd className="font-dash-mono text-[11px] text-dash-thi">{value}</dd>
    </div>
  )
}

export type EarlyGemGridProps = {
  gems: UnifiedSignal[]
  loading: boolean
}

export function EarlyGemGrid({ gems, loading }: EarlyGemGridProps) {
  return (
    <section id="early-gems" className="rounded-dash border border-dash-hairline bg-dash-panel p-4 md:p-5">
      <SectionHeader
        icon={Gem}
        title="EARLY GEM DETECTOR"
        subtitle="High potential tokens before they explode"
        action={
          <Link href="/dashboard/signals" className="text-xs text-dash-green hover:underline">
            View All
          </Link>
        }
      />

      {loading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
      ) : gems.length === 0 ? (
        <p className="mt-6 text-center text-xs text-dash-tmid">No early gems detected — listening for new token signals.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {gems.map((g) => (
            <GemCard key={g.id} signal={g} />
          ))}
        </div>
      )}
    </section>
  )
}
