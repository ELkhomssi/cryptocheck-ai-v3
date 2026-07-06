'use client'

import { useCallback, useState } from 'react'
import { QuickScanBar } from '@/components/revenue-dashboard/QuickScanBar'
import { OverviewCards } from '@/components/revenue-dashboard/OverviewCards'

export default function RevenueOverviewPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  const onScanned = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <div className="space-y-6">
      <header>
        <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-rd-green">
          Overview
        </p>
        <h2 className="mt-1 font-rd-display text-xl font-bold uppercase tracking-[0.06em] text-rd-hi md:text-2xl">
          Scan → Swap funnel
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-rd-mid">
          Paste a mint, read the neural verdict, then route a risk-gated swap with a transparent platform fee.
        </p>
      </header>

      <QuickScanBar onScanned={onScanned} />
      <OverviewCards key={refreshKey} />
    </div>
  )
}
