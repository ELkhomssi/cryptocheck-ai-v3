'use client'

import { RewardsWidget } from '@/components/dash-home/RewardsWidget'
import { DashToastProvider } from '@/components/dash-home/DashToast'
import Link from 'next/link'

/** Engagement rewards — kept off the trading Action Panel / Sniper rail. */
export default function DashboardRewardsPage() {
  return (
    <DashToastProvider>
      <div className="mx-auto max-w-lg space-y-4 px-4 py-8">
        <Link href="/dashboard" className="text-xs text-zinc-500 underline hover:text-zinc-300">
          ← Back to Dashboard
        </Link>
        <h1 className="text-lg font-semibold text-zinc-100">Rewards</h1>
        <p className="text-sm text-zinc-500">
          Optional engagement spin — separate from Scan, Swap, and Sniper execution tools.
        </p>
        <RewardsWidget />
      </div>
    </DashToastProvider>
  )
}
