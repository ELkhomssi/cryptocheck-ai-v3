'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { truncateWallet, type TopTradersResult } from '@/lib/command-center/top-traders-types'

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <span className="inline-block h-6 w-16 rounded bg-white/5" aria-hidden />
  }
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const w = 64
  const h = 24
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={w} height={h} className="text-[var(--cc-green)]" aria-hidden>
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
          reason: 'Leaderboard unlocks with live trading volume through CryptoCheck swaps.',
        }),
      )
  }, [])

  return (
    <section id="top-traders" className="cc-panel p-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="cc-label text-[var(--cc-hi)]">Top Traders</p>
          <p className="text-[0.65rem] text-[var(--cc-lo)]">Last 30 days</p>
        </div>
        <span className="text-xs text-[var(--cc-lo)]">View All</span>
      </header>

      {!data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded cc-shimmer" />
          ))}
        </div>
      ) : data.status === 'soon' ? (
        <div className="rounded-lg border border-dashed border-[var(--cc-inner)] px-4 py-8 text-center">
          <p className="cc-label text-[var(--cc-amber)]">Soon</p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--cc-mid)]">{data.reason}</p>
          <Link
            href="/app/upgrade"
            className="mt-4 inline-block rounded-lg border border-[var(--cc-green)]/40 px-4 py-2 text-xs font-semibold text-[var(--cc-green)]"
          >
            Join waitlist via Pro
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-2 text-[0.58rem] text-[var(--cc-lo)]">{data.label}</p>
          <ul className="space-y-2">
            {data.traders.map((t) => (
              <li
                key={t.walletAddress}
                className="flex items-center gap-2 rounded-lg border border-[var(--cc-inner)] px-2 py-2"
              >
                <span className="cc-mono w-4 text-[0.62rem] text-[var(--cc-lo)]">{t.rank}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--cc-green-deep)] text-[0.58rem] font-bold text-[var(--cc-green)]">
                  {t.rank}
                </span>
                <span className="cc-mono min-w-0 flex-1 truncate text-xs text-[var(--cc-hi)]">
                  {truncateWallet(t.walletAddress)}
                </span>
                <span className="cc-mono text-xs font-semibold text-[var(--cc-green)]">
                  ${t.volumeUsd.toLocaleString()}
                </span>
                <MiniSparkline values={t.sparkline} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        href="/dashboard/revenue/portfolio"
        className="mt-4 block w-full rounded-lg border border-[var(--cc-inner)] py-2 text-center text-xs font-semibold text-[var(--cc-mid)] hover:text-[var(--cc-hi)]"
      >
        Track Top Traders
      </Link>
    </section>
  )
}
