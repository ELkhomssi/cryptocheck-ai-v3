'use client'

import Link from 'next/link'
import { Bell, MessageSquare } from 'lucide-react'
import type { AlphaFeedStats } from '@/lib/command-center/stats'
import { StatTile } from './primitives/StatTile'
import { AccountChip, UpgradeProChip } from './AccountChip'

export type TopStatsBarProps = {
  stats: AlphaFeedStats
  loading: boolean
  userEmail: string
  effectiveTier: string
  isAnonymousPreview?: boolean
}

export function TopStatsBar({ stats, loading, userEmail, effectiveTier, isAnonymousPreview }: TopStatsBarProps) {
  const name = userEmail ? userEmail.split('@')[0] : 'Guest'

  return (
    <header className="rounded-dash border border-dash-hairline bg-dash-panel p-4 md:p-5">
      {isAnonymousPreview ? (
        <p className="mb-3 rounded-dash-inner border border-dash-amber/30 bg-dash-amber/10 px-3 py-2 text-xs text-dash-amber">
          Preview mode —{' '}
          <Link href="/landing?next=%2Fdashboard" className="font-semibold text-dash-green underline">
            Sign in
          </Link>{' '}
          for live quotas.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <MessageSquare className="mt-0.5 h-4 w-4 text-dash-green" />
          <div>
            <p className="text-[13px] font-semibold text-dash-green">SMART ALPHA FEED</p>
            <p className="text-xs text-dash-tmid">Real-time opportunities from top crypto channels</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <UpgradeProChip />
          <Link
            href="/dashboard/alerts"
            className="relative flex h-9 w-9 items-center justify-center rounded-dash-chip border border-dash-innerline text-dash-tmid hover:text-dash-thi focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-dash-green" />
          </Link>
          <AccountChip name={name} tier={effectiveTier} />
        </div>
      </div>

      <div className="mt-4 flex divide-x divide-dash-innerline overflow-x-auto">
        <StatTile
          label="Total Opportunities"
          value={stats.totalOpportunities}
          delta={stats.totalOpportunities24h}
          loading={loading}
        />
        <StatTile
          label="Avg AI Score"
          value={stats.avgAiScore}
          loading={loading}
          format={(n) => n.toFixed(1)}
        />
        <StatTile label="Total Mentions" value={stats.totalMentions} delta={stats.totalMentions24h} loading={loading} />
        <StatTile
          label="Smart Money Moves"
          value={stats.smartMoneyMoves}
          delta={stats.smartMoneyMoves24h}
          loading={loading}
        />
      </div>
    </header>
  )
}
