'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { useSignalFeed } from '@/lib/signals-dashboard/use-signal-feed'
import { BottomDeck } from './BottomDeck'
import { ChartGrid } from './ChartGrid'
import { CoachRail, useCoachRailTab } from './CoachRail'
import { ExecutionTicket } from './ExecutionTicket'
import { IconRail, type TerminalPane } from './IconRail'
import { KeyboardHelp } from './KeyboardHelp'
import { LeftColumn } from './LeftColumn'
import { MarketMetricsBar } from './MarketMetricsBar'
import { CenterAuxRow } from './CenterAuxRow'
import { TerminalFocusProvider, useTerminalFocus } from './TerminalFocusProvider'
import { TerminalStatusBar } from './TerminalStatusBar'
import { TerminalTopBar } from './TerminalTopBar'
import { useTerminalKeyboard } from './useTerminalKeyboard'

type DiscoverWindow = '1H' | '6H' | '24H'

function filterByWindow(rows: UnifiedSignal[], win: DiscoverWindow): UnifiedSignal[] {
  const ms = win === '1H' ? 3_600_000 : win === '6H' ? 21_600_000 : 86_400_000
  const cut = Date.now() - ms
  return rows.filter((r) => {
    const t = Date.parse(r.msgTimestamp || r.ingestTimestamp)
    return Number.isFinite(t) ? t >= cut : true
  })
}

function TerminalWorkspace() {
  const feed = useSignalFeed({ subjectType: 'token' })
  const allRows = useMemo(() => {
    return feed.orderedIds
      .map((id) => feed.signals.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s?.contractAddress))
      .slice(0, 120)
  }, [feed.orderedIds, feed.signals])

  const [discoverWindow, setDiscoverWindow] = useState<DiscoverWindow>('24H')
  const rows = useMemo(
    () => filterByWindow(allRows, discoverWindow),
    [allRows, discoverWindow],
  )

  const [coachTab, setCoachTab] = useCoachRailTab()
  const [helpOpen, setHelpOpen] = useState(false)
  const [pane, setPane] = useState<TerminalPane>('discover')

  const chartsRef = useRef<HTMLDivElement>(null)
  const sniperRef = useRef<HTMLDivElement>(null)
  const portfolioRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const intelRef = useRef<HTMLDivElement>(null)

  useTerminalKeyboard(rows, {
    onTabVerdict: () => setCoachTab('intel'),
    onTabRecord: () => setCoachTab('record'),
    onTabBrief: () => setCoachTab('brief'),
    onTabBehavior: () => setCoachTab('behavior'),
    onTabOutcomes: () => setCoachTab('outcomes'),
    onToggleHelp: () => setHelpOpen((v) => !v),
    onCloseOverlays: () => setHelpOpen(false),
    helpOpen,
  })

  const { hydrated, setDiscoverCollapsed, setSolPriceUsd } = useTerminalFocus()

  // Keep SOL price on focus bus for Trade Plan / Portfolio Impact
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/sol-price', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const body = (await res.json()) as { price?: number; source?: string }
        if (typeof body.price === 'number' && body.source !== 'fallback') {
          setSolPriceUsd(body.price)
        }
      } catch {
        /* ignore */
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [setSolPriceUsd])

  const onPane = (p: TerminalPane) => {
    setPane(p)
    if (p === 'help') {
      setHelpOpen(true)
      return
    }
    if (p === 'discover' || p === 'watchlists') {
      setDiscoverCollapsed(false)
      return
    }
    if (p === 'charts') chartsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (p === 'sniper') sniperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (p === 'portfolio') portfolioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (p === 'history') historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (p === 'intel') intelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  if (!hydrated) {
    return (
      <div className="tit-shell flex h-screen items-center justify-center">
        <div className="space-y-2 text-center">
          <div className="tit-skeleton mx-auto h-8 w-48" />
          <p className="text-xs text-[var(--tit-text-2)]">Restoring workspace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="tit-shell tit-shell-grid">
      <TerminalTopBar onHelp={() => setHelpOpen(true)} />
      <MarketMetricsBar />
      <IconRail active={pane} onSelect={onPane} />

      <div className="tit-area-left min-h-0 overflow-hidden">
        <LeftColumn
          rows={rows}
          loading={feed.feedState === 'loading'}
          error={feed.errorMessage}
          connectionLabel={
            feed.connection === 'live'
              ? 'live'
              : feed.connection === 'connecting'
                ? '…'
                : feed.connection
          }
          onRetry={() => feed.reload()}
          window={discoverWindow}
          onWindow={setDiscoverWindow}
        />
      </div>

      <div className="tit-area-center flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden p-1.5">
        <div ref={chartsRef} className="flex min-h-0 flex-1 flex-col">
          <ChartGrid />
        </div>
        <div ref={sniperRef} className="shrink-0">
          <CenterAuxRow />
        </div>
      </div>

      <div className="tit-area-coach flex min-h-0 flex-col overflow-hidden border-l border-[var(--tit-border)] bg-[var(--tit-bg-0)]">
        <div className="min-h-0 flex-1 overflow-hidden">
          <CoachRail tab={coachTab} onTab={setCoachTab} />
        </div>
        <div className="max-h-[42%] min-h-[200px] shrink-0 border-t border-[var(--tit-border)]">
          <ExecutionTicket />
        </div>
      </div>

      <div ref={portfolioRef} className="tit-area-bottom min-h-0 overflow-hidden border-t border-[var(--tit-border)] p-1">
        <div ref={historyRef}>
          <div ref={intelRef}>
            <BottomDeck intelRows={allRows} />
          </div>
        </div>
      </div>

      <TerminalStatusBar />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

export function TerminalShell() {
  return (
    <TerminalFocusProvider>
      <TerminalWorkspace />
    </TerminalFocusProvider>
  )
}
