'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { appToolUrl } from '@/lib/dashboard/app-routes'
import { truncateWallet, type TopTradersResult } from '@/lib/command-center/top-traders-types'

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="inline-block h-5 w-[60px] rounded bg-dash-inset" aria-hidden />
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 60
      const y = 20 - ((v - min) / range) * 20
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={60} height={20} className="text-dash-green" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} />
    </svg>
  )
}

export function TopTradersPanel() {
  const [data, setData] = useState<TopTradersResult | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/command-center/top-traders', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setData(j as TopTradersResult))
      .catch(() =>
        setData({
          status: 'soon',
          reason: 'Leaderboard unlocks with live trading',
        }),
      )
  }, [])

  return (
    <section id="top-traders" className="rounded-dash border border-dash-hairline bg-dash-panel p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-dash-green">TOP SMART MONEY</p>
          <p className="text-[11px] text-dash-tmid">Last 30 Days</p>
        </div>
        <span className="text-xs text-dash-tlo">View All</span>
      </header>

      {!data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-shimmer rounded bg-dash-panel2" />
          ))}
        </div>
      ) : data.status === 'soon' ? (
        <div className="rounded-dash-inner border border-dashed border-dash-innerline px-4 py-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-dash-amber">Soon</p>
          <p className="mt-2 text-xs leading-relaxed text-dash-tmid">{data.reason}</p>
          <Link
            href="/app/upgrade"
            className="mt-4 inline-block rounded-dash-chip border border-dash-green/40 px-4 py-2 text-xs font-semibold text-dash-green transition-colors duration-150 hover:bg-dash-greenDim"
          >
            Join waitlist via Pro
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-2 text-[10px] text-dash-tlo">{data.label}</p>
          <ul className="space-y-2">
            {data.traders.map((t) => (
              <li
                key={t.walletAddress}
                className="flex items-center gap-2 rounded-dash-inner border border-dash-innerline px-2 py-2"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-dash-greenDeep text-[10px] font-bold text-dash-green">
                  {t.rank}
                </span>
                <span className="font-dash-mono min-w-0 flex-1 truncate text-xs text-dash-thi">
                  {truncateWallet(t.walletAddress)}
                </span>
                <span className="font-dash-mono text-xs font-semibold text-dash-green">
                  ${t.volumeUsd.toLocaleString()}
                </span>
                <Sparkline values={t.sparkline} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        href={appToolUrl('whales')}
        className="mt-4 block w-full rounded-dash-chip border border-dash-hairline py-2 text-center text-xs font-semibold text-dash-tmid transition-colors duration-150 hover:border-white/20 hover:bg-dash-panel2 hover:text-dash-thi focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
      >
        Track Smart Money
      </Link>
    </section>
  )
}
