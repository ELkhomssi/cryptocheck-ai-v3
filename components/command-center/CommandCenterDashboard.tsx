'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentFeedEvent, Decision, UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { ScanResult } from '@/lib/revenue-dashboard/types'
import { ConnectionPill } from '@/components/command-center/ConnectionPill'
import { FeedErrorCard } from '@/components/command-center/FeedErrorCard'
import { SignalSwapSheet } from '@/components/signals-dashboard/SignalSwapSheet'
import { useSignalFeed } from '@/lib/signals-dashboard/use-signal-feed'
import {
  buildTickerAlerts,
} from '@/lib/command-center/alerts'
import {
  computeAlphaFeedStats,
  groupLiveMatches,
  pickEarlyGems,
  rankHotOpportunities,
  type HotSortKey,
} from '@/lib/command-center/stats'
import { COMPLIANCE_DISCLAIMER } from '@/lib/revenue-dashboard/constants'
import { CommandCenterSidebar } from './CommandCenterSidebar'
import { CommandCenterTopBar } from './CommandCenterTopBar'
import { DataSourcesStrip } from './DataSourcesStrip'
import { HotOpportunitiesTable } from './HotOpportunitiesTable'
import { EarlyGemCards } from './EarlyGemCards'
import { TxOddsLiveMatches } from './TxOddsLiveMatches'
import { AiTokenScannerPanel } from './AiTokenScannerPanel'
import { TopTradersPanel } from './TopTradersPanel'
import { AlertsTicker } from './AlertsTicker'

type Props = {
  userEmail: string
  effectiveTier: string
  isAnonymousPreview?: boolean
}

export function CommandCenterDashboard({ userEmail, effectiveTier, isAnonymousPreview }: Props) {
  const premiumToken =
    typeof process.env.NEXT_PUBLIC_SIGNAL_PREMIUM_TOKEN === 'string'
      ? process.env.NEXT_PUBLIC_SIGNAL_PREMIUM_TOKEN
      : undefined

  const { signals, connection, loading, degraded, recentIds } = useSignalFeed(
    {},
    { premiumToken },
  )

  const allSignals = useMemo(() => [...signals.values()], [signals])
  const stats = useMemo(() => computeAlphaFeedStats(allSignals), [allSignals])

  const [sort, setSort] = useState<HotSortKey>('score')
  const [filter24h, setFilter24h] = useState(true)
  const hotRows = useMemo(
    () => rankHotOpportunities(allSignals, sort, filter24h),
    [allSignals, sort, filter24h],
  )
  const gems = useMemo(() => pickEarlyGems(allSignals), [allSignals])
  const liveMatches = useMemo(() => groupLiveMatches(allSignals), [allSignals])

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

  const decisionsByMatch = useMemo(() => {
    const map = new Map<string, Decision>()
    for (const ev of agentEvents) {
      if (ev.type !== 'agent.decision') continue
      map.set(ev.decision.matchId, ev.decision)
    }
    return map
  }, [agentEvents])

  const tickerAlerts = useMemo(
    () => buildTickerAlerts(allSignals, agentEvents),
    [allSignals, agentEvents],
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
    } catch {
      /* console only — UI stays calm */
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

  return (
    <div className="cc-shell flex min-h-screen">
      <CommandCenterSidebar
        userEmail={userEmail}
        effectiveTier={effectiveTier}
        isAnonymousPreview={isAnonymousPreview}
      />

      <div className="flex min-w-0 flex-1 flex-col md:pl-[240px]">
        <CommandCenterTopBar
          stats={stats}
          statsLoading={loading && allSignals.length === 0}
          userEmail={userEmail}
          effectiveTier={effectiveTier}
          isAnonymousPreview={isAnonymousPreview}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cc-inner)] px-4 py-2 md:px-6">
          <ConnectionPill
            state={connection}
            tier={effectiveTier}
            delayLabel={connection === 'live' ? 'live' : undefined}
            className="!border-[var(--cc-inner)] !bg-[var(--cc-panel-2)]"
          />
        </div>

        <DataSourcesStrip />

        {degraded ? (
          <div className="px-4 md:px-6">
            <FeedErrorCard onRetry={() => window.location.reload()} />
          </div>
        ) : null}

        <div className="grid flex-1 grid-cols-1 gap-4 px-4 py-4 pb-14 lg:grid-cols-[1fr_320px] md:px-6">
          <div className="space-y-4">
            <HotOpportunitiesTable
              rows={hotRows}
              loading={loading && allSignals.length === 0}
              sort={sort}
              onSort={setSort}
              filter24h={filter24h}
              onFilter24h={setFilter24h}
              onScan={onScanRow}
              onSwap={onSwap}
              recentIds={recentIds}
            />
            <EarlyGemCards gems={gems} loading={loading && allSignals.length === 0} />
            <TxOddsLiveMatches
              matches={liveMatches}
              decisionsByMatch={decisionsByMatch}
              loading={loading && allSignals.length === 0}
            />
          </div>

          <aside className="space-y-4">
            <AiTokenScannerPanel scan={scan} scanning={scanning} onScanMint={runScan} />
            <TopTradersPanel />
          </aside>
        </div>

        <p className="px-6 pb-16 text-center text-[0.62rem] text-[var(--cc-lo)]">
          {COMPLIANCE_DISCLAIMER} · Sports signals informational only ·{' '}
          <a href="/legal/terms" className="text-[var(--cc-green)] hover:underline">
            Terms
          </a>
        </p>

        <AlertsTicker alerts={tickerAlerts} />
      </div>

      <SignalSwapSheet signal={swapSignal} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
