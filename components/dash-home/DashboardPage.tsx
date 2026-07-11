'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentFeedEvent, UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { ScanResult } from '@/lib/revenue-dashboard/types'
import { SignalSwapSheet } from '@/components/signals-dashboard/SignalSwapSheet'
import { useSignalFeed } from '@/lib/signals-dashboard/use-signal-feed'
import { buildTickerAlerts } from '@/lib/command-center/alerts'
import {
  computeAlphaFeedStats,
  pickEarlyGems,
  rankHotOpportunities,
  type HotSortKey,
} from '@/lib/command-center/stats'
import { COMPLIANCE_DISCLAIMER, FEE_DISCLOSURE_PATH, TERMS_PATH } from '@/lib/revenue-dashboard/constants'
import { SidebarNav } from './SidebarNav'
import { TopStatsBar } from './TopStatsBar'
import { DataSourcesStrip } from './DataSourcesStrip'
import { HotOpportunitiesTable } from './HotOpportunitiesTable'
import { EarlyGemGrid } from './EarlyGemGrid'
import { AITokenScannerPanel } from './AITokenScannerPanel'
import { TopTradersPanel } from './TopTradersPanel'
import { AlertsTicker } from './AlertsTicker'
import { ReconnectPill } from './primitives/ReconnectPill'

export type DashboardPageProps = {
  userEmail: string
  effectiveTier: string
  isAnonymousPreview?: boolean
}

export function DashboardPage({ userEmail, effectiveTier, isAnonymousPreview }: DashboardPageProps) {
  const premiumToken =
    typeof process.env.NEXT_PUBLIC_SIGNAL_PREMIUM_TOKEN === 'string'
      ? process.env.NEXT_PUBLIC_SIGNAL_PREMIUM_TOKEN
      : undefined

  const { signals: tokenSignalsMap, connection, loading, recentIds } = useSignalFeed(
    { subjectType: 'token' },
    { premiumToken },
  )
  const { signals: sportsSignalsMap } = useSignalFeed(
    { subjectType: 'match_event' },
    { premiumToken },
  )
  const reconnecting = connection === 'reconnecting' || connection === 'connecting'

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const tokenSignals = useMemo(() => [...tokenSignalsMap.values()], [tokenSignalsMap])
  const sportsSignals = useMemo(() => [...sportsSignalsMap.values()], [sportsSignalsMap])
  const stats = useMemo(() => computeAlphaFeedStats(tokenSignals), [tokenSignals])

  const [sort, setSort] = useState<HotSortKey>('score')
  const [filter24h, setFilter24h] = useState(true)
  const hotRows = useMemo(
    () => rankHotOpportunities(tokenSignals, sort, filter24h),
    [tokenSignals, sort, filter24h],
  )
  const gems = useMemo(() => pickEarlyGems(tokenSignals), [tokenSignals])

  const [agentEvents, setAgentEvents] = useState<AgentFeedEvent[]>([])
  useEffect(() => {
    fetch('/api/signals/agent/tape', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const tape = Array.isArray(j.tape) ? j.tape : []
        setAgentEvents(tape.map((t: { event: AgentFeedEvent }) => t.event))
      })
      .catch(() => setAgentEvents([]))
  }, [])

  const tickerAlerts = useMemo(
    () => buildTickerAlerts([...tokenSignals, ...sportsSignals], agentEvents),
    [tokenSignals, sportsSignals, agentEvents],
  )

  const [scan, setScan] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [swapSignal, setSwapSignal] = useState<UnifiedSignal | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const runScan = useCallback(async (mint: string) => {
    setScanning(true)
    try {
      const res = await fetch('/api/revenue/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint }),
      })
      const body = await res.json()
      if (res.ok) setScan(body as ScanResult)
    } catch (e) {
      console.error('[dashboard] scan failed', e)
    } finally {
      setScanning(false)
    }
  }, [])

  const onScanRow = useCallback(
    (signal: UnifiedSignal) => {
      const mint = signal.contractAddress?.trim()
      if (mint) void runScan(mint)
    },
    [runScan],
  )

  const onSwap = useCallback((signal: UnifiedSignal) => {
    setSwapSignal(signal)
    setSheetOpen(true)
  }, [])

  const isLoading = loading && tokenSignals.length === 0
  const sideCol = sidebarCollapsed ? '64px' : '232px'

  return (
    <div className="min-h-screen bg-dash-bg text-dash-thi">
      <div
        className="mx-auto grid min-h-screen grid-cols-1 gap-4 p-4 pb-14 min-[1100px]:grid-cols-[var(--dash-side)_minmax(0,1fr)] xl:grid-cols-[var(--dash-side)_minmax(0,1fr)_320px]"
        style={{ '--dash-side': sideCol } as React.CSSProperties}
      >
        <SidebarNav
          userEmail={userEmail}
          effectiveTier={effectiveTier}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          mobileOpen={mobileNavOpen}
          onMobileOpenChange={setMobileNavOpen}
        />

        <div className="flex min-w-0 flex-col gap-4 min-[1100px]:col-start-2 xl:col-start-2">
          <TopStatsBar
            stats={stats}
            loading={isLoading}
            userEmail={userEmail}
            effectiveTier={effectiveTier}
            isAnonymousPreview={isAnonymousPreview}
          />
          {reconnecting ? (
            <div className="flex justify-end">
              <ReconnectPill />
            </div>
          ) : null}
          <DataSourcesStrip />
          <HotOpportunitiesTable
            rows={hotRows}
            loading={isLoading}
            sort={sort}
            onSort={setSort}
            filter24h={filter24h}
            onFilter24h={setFilter24h}
            onScan={onScanRow}
            onSwap={onSwap}
            recentIds={recentIds}
            reconnecting={reconnecting}
          />
          <EarlyGemGrid gems={gems} loading={isLoading} />
        </div>

        <aside className="flex min-w-0 flex-col gap-4 min-[1100px]:col-start-2 xl:col-start-3 xl:row-span-1">
          <AITokenScannerPanel scan={scan} scanning={scanning} onScanMint={runScan} />
          <TopTradersPanel />
        </aside>

        <div className="min-[1100px]:col-span-2 min-[1100px]:col-start-2 xl:col-span-2 xl:col-start-2">
          <AlertsTicker alerts={tickerAlerts} />
          <p className="mt-3 text-center text-[11px] text-dash-tlo">
            {COMPLIANCE_DISCLAIMER} · Sports signals informational only ·{' '}
            <a href={TERMS_PATH} className="text-dash-green hover:underline">
              Terms
            </a>{' '}
            ·{' '}
            <a href={FEE_DISCLOSURE_PATH} className="text-dash-green hover:underline">
              Fee disclosure
            </a>
          </p>
        </div>
      </div>

      <SignalSwapSheet signal={swapSignal} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
