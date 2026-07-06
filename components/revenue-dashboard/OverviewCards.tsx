'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSolana } from '@/components/SolanaProvider'
import { REVENUE_NAV } from '@/lib/revenue-dashboard/constants'
import { readScanActivity, type ActivityItem } from './QuickScanBar'

type OverviewPayload = {
  feesEarnedUsd: number
  feesSwapCount: number
  portfolio: {
    holdingCount: number
    flaggedCount: number
    scannedCount: number
    partial: boolean
  } | null
}

function formatUsd(n: number) {
  if (n <= 0) return '$0.00'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

export function OverviewCards() {
  const { walletAddress, isConnected } = useSolana()
  const [overview, setOverview] = useState<OverviewPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : ''
      const res = await fetch(`/api/revenue/overview${q}`, { cache: 'no-store' })
      if (res.ok) {
        setOverview((await res.json()) as OverviewPayload)
      }
    } catch {
      setOverview(null)
    } finally {
      setLoading(false)
    }
    setActivity(readScanActivity())
  }, [walletAddress])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <article className="rd-panel p-4 md:col-span-1">
        <p className="rd-label mb-2">Portfolio risk</p>
        {!isConnected || !walletAddress ? (
          <p className="text-sm text-rd-mid">Connect a wallet to scan your holdings.</p>
        ) : loading && !overview ? (
          <p className="font-rd-mono text-sm text-rd-lo">Loading…</p>
        ) : overview?.portfolio ? (
          <div className="space-y-2">
            <p className="font-rd-mono text-2xl tabular-nums text-rd-hi">
              {overview.portfolio.holdingCount}
              <span className="ml-2 text-sm font-sans text-rd-mid">holdings</span>
            </p>
            <p className="text-sm text-rd-mid">
              <span className="font-rd-mono tabular-nums text-rd-caution">
                {overview.portfolio.flaggedCount}
              </span>{' '}
              flagged (risk ≥ caution)
              {overview.portfolio.partial ? (
                <span className="block text-xs text-rd-lo mt-1">
                  Based on top {overview.portfolio.scannedCount} by value — open Portfolio for full scan.
                </span>
              ) : null}
            </p>
            <Link
              href={REVENUE_NAV.portfolio}
              className="inline-block text-xs font-rd-display uppercase tracking-wider text-rd-green hover:underline"
            >
              Open portfolio →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-rd-mid">No token holdings found for this wallet.</p>
        )}
      </article>

      <article className="rd-panel p-4 md:col-span-1">
        <p className="rd-label mb-2">Recent activity</p>
        {activity.length === 0 ? (
          <p className="text-sm text-rd-mid">No scans or swaps in this session yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activity.slice(0, 6).map((item) => (
              <li key={`${item.mint}-${item.at}`} className="flex items-center justify-between gap-2">
                <span className="truncate font-rd-mono text-xs text-rd-mid">
                  {item.mint.slice(0, 6)}…{item.mint.slice(-4)}
                </span>
                <span className="shrink-0 text-xs text-rd-lo">
                  {item.type === 'scan' ? `${item.verdict} · scan` : 'swap'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="rd-panel p-4 md:col-span-1 lg:col-span-1">
        <p className="rd-label mb-2">Fees earned</p>
        {loading && overview == null ? (
          <p className="font-rd-mono text-sm text-rd-lo">Loading…</p>
        ) : (
          <>
            <p className="font-rd-mono text-2xl tabular-nums text-rd-hi">
              {formatUsd(overview?.feesEarnedUsd ?? 0)}
            </p>
            <p className="mt-1 text-sm text-rd-mid">
              {overview?.feesSwapCount ?? 0} confirmed swaps with recorded fees
            </p>
            {(overview?.feesSwapCount ?? 0) === 0 ? (
              <p className="mt-2 text-xs text-rd-lo">
                No platform fees recorded yet — values update after real swaps execute.
              </p>
            ) : null}
            <Link
              href={REVENUE_NAV.revenue}
              className="mt-2 inline-block text-xs font-rd-display uppercase tracking-wider text-rd-green hover:underline"
            >
              Fee dashboard →
            </Link>
          </>
        )}
      </article>
    </div>
  )
}
