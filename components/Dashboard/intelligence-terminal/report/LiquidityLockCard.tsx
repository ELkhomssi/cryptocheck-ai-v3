'use client'

/**
 * LiquidityLockCard — Phase 4C (v2 only).
 *
 * Communicates liquidity safety at a glance:
 *   burned   → flame icon, green "Burned"
 *   locked   → lock icon, cyan "Locked" + expiry date
 *   unlocked → open lock icon, rose "Unlocked"
 *   unknown  → question icon, slate "Unknown"
 */

import { Flame, HelpCircle, Lock, LockOpen } from 'lucide-react'
import type { TokenIntelligenceReport } from '@/lib/types/intelligence'
import { Card } from '../primitives/Card'
import { formatDate, formatPercent } from '../primitives/format'

const STATUS_MAP = {
  burned: {
    icon: Flame,
    accent: 'safe' as const,
    iconClass: 'text-[#00d4aa]',
    ringClass: 'ring-[#00d4aa]/30 bg-[#00d4aa]/10',
    label: 'Liquidity Burned',
    description: 'LP tokens sent to a burn address — irreversible.',
  },
  locked: {
    icon: Lock,
    accent: 'safe' as const,
    iconClass: 'text-[#00d4aa]',
    ringClass: 'ring-[#00d4aa]/30 bg-[#00d4aa]/10',
    label: 'Liquidity Locked',
    description: 'LP tokens held in a time-locked vault.',
  },
  unlocked: {
    icon: LockOpen,
    accent: 'danger' as const,
    iconClass: 'text-[#ff4757]',
    ringClass: 'ring-rose-500/30 bg-rose-500/10',
    label: 'Liquidity Unlocked',
    description: 'LP tokens are movable — rug risk.',
  },
  unknown: {
    icon: HelpCircle,
    accent: 'neutral' as const,
    iconClass: 'text-slate-400',
    ringClass: 'ring-white/10 bg-white/5',
    label: 'Lock Unknown',
    description: 'Could not determine liquidity lock status.',
  },
} as const

export function LiquidityLockCard({
  report,
}: {
  report: TokenIntelligenceReport
}) {
  const info = report.liquidityLock
  const status = info?.status ?? 'unknown'
  const tone = STATUS_MAP[status]
  const Icon = tone.icon
  const detailReason = info?.reason?.trim() || tone.description

  return (
    <Card accent={tone.accent} className="p-5">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        Liquidity lock
      </div>

      <div className="flex items-center gap-4">
        <div
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ${tone.ringClass}`}
          aria-hidden
        >
          <Icon className={`h-6 w-6 ${tone.iconClass}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono-terminal text-sm font-semibold text-slate-100">
            {tone.label}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{tone.description}</p>
        </div>
      </div>

      {/* Details strip */}
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/5 pt-3 font-mono-terminal text-xs">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Burned
          </dt>
          <dd className="mt-1 tabular-nums text-slate-200">
            {formatPercent(info?.burnedPct ?? null)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Lock until
          </dt>
          <dd className="mt-1 text-slate-200">
            {formatDate(info?.lockUntil ?? null)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-500" title={detailReason}>
        {detailReason}
      </p>
    </Card>
  )
}
