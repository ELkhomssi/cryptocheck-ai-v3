'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { StatTile } from './StatTile'
import type { AlphaFeedStats } from '@/lib/command-center/stats'

type Props = {
  stats: AlphaFeedStats
  statsLoading: boolean
  userEmail: string
  effectiveTier: string
  isAnonymousPreview?: boolean
}

export function CommandCenterTopBar({
  stats,
  statsLoading,
  userEmail,
  effectiveTier,
  isAnonymousPreview,
}: Props) {
  const displayName = userEmail ? userEmail.split('@')[0] : 'Guest'

  return (
    <header className="border-b border-[var(--cc-hairline)] bg-[var(--cc-panel)]/90 px-4 py-4 backdrop-blur-md md:px-6">
      {isAnonymousPreview ? (
        <div className="mb-3 rounded-lg border border-[var(--cc-amber)]/30 bg-[var(--cc-amber)]/10 px-3 py-2 text-xs text-[var(--cc-amber)]">
          Preview mode — sign in for live quotas and personalized feed.{' '}
          <Link href="/landing?next=%2Fdashboard" className="font-semibold text-[var(--cc-green)] underline">
            Sign in
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="cc-label text-[var(--cc-green)]">Smart Alpha Feed</p>
          <h1 className="mt-1 text-lg font-semibold text-[var(--cc-hi)] md:text-xl">
            Real-time opportunities from top crypto channels
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/app/upgrade"
            className="rounded-lg bg-gradient-to-r from-[var(--cc-gold)]/20 to-[var(--cc-amber)]/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--cc-gold)] ring-1 ring-[var(--cc-gold)]/30 hover:ring-[var(--cc-gold)]/50"
          >
            Upgrade to Pro
          </Link>
          <Link
            href="/dashboard/alerts"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--cc-inner)] text-[var(--cc-mid)] hover:text-[var(--cc-hi)]"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Link>
          <div className="cc-panel-2 flex items-center gap-2 rounded-full px-3 py-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--cc-green-deep)] text-xs font-bold text-[var(--cc-green)]">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-[var(--cc-hi)]">{displayName}</p>
              <p className="text-[0.58rem] uppercase text-[var(--cc-lo)]">{effectiveTier} member</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatTile
          label="Total Opportunities"
          value={stats.totalOpportunities}
          delta24h={stats.totalOpportunities24h}
          loading={statsLoading}
        />
        <StatTile
          label="Avg AI Score"
          value={stats.avgAiScore}
          loading={statsLoading}
          format={(n) => n.toFixed(1)}
        />
        <StatTile
          label="Total Mentions"
          value={stats.totalMentions}
          delta24h={stats.totalMentions24h}
          loading={statsLoading}
        />
        <StatTile
          label="Smart Money Moves"
          value={stats.smartMoneyMoves}
          delta24h={stats.smartMoneyMoves24h}
          loading={statsLoading}
        />
      </div>
    </header>
  )
}
