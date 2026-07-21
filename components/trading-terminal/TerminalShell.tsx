'use client'

import { useMemo, useRef, useState } from 'react'
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
    onTabVerdict: () => setCoachTab('verdict'),
    onTabRecord: () => setCoachTab('record'),
    onTabBrief: () => setCoachTab('brief'),
    onTabBehavior: () => setCoachTab('behavior'),
    onTabOutcomes: () => setCoachTab('outcomes'),
    onToggleHelp: () => setHelpOpen((v) => !v),
    onCloseOverlays: () => setHelpOpen(false),
    helpOpen,
  })

  const { hydrated, setDiscoverCollapsed } = useTerminalFocus()

  const onPane = (p: TerminalPane) => {
    setPane(p)
    if (p === 'discover') {
      setDiscoverCollapsed(false)
      return
    }
    if (p === 'charts') chartsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (p === 'sniper') sniperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (p === 'portfolio') portfolioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (p === 'history') historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (p === 'intel') intelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (p === 'watchlists') setDiscoverCollapsed(false)
  }

  if (!hydrated) {
    return (
      <div className="tit-shell flex h-screen items-center justify-center">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-8 w-48 animate-pulse rounded bg-[var(--tit-bg-3)]" />
          <p className="text-xs text-[var(--tit-text-2)]">Restoring workspace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="tit-shell flex h-screen flex-col overflow-hidden">
      <TerminalTopBar onHelp={() => setHelpOpen(true)} />
      <MarketMetricsBar />

      <div className="flex min-h-0 flex-1">
        <IconRail active={pane} onSelect={onPane} />

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

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden p-1.5">
          <div ref={chartsRef} className="flex min-h-0 flex-[1.35] flex-col gap-1">
            <div className="flex shrink-0 items-center gap-2 px-0.5">
              <p className="tit-label">Multi-Chart Workspace</p>
              <span className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">
                DexScreener embed · drag Discover onto slots
              </span>
            </div>
            <ChartGrid />
          </div>

          <div ref={sniperRef} className="min-h-0 shrink-0">
            <div ref={portfolioRef}>
              <div ref={historyRef}>
                <div ref={intelRef}>
                  <BottomDeck intelRows={allRows} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex shrink-0 flex-col gap-1.5 border-l border-[var(--tit-border)] bg-[var(--tit-bg-0)] p-1.5"
          style={{ width: 'var(--tit-right-panel)' }}
        >
          <div className="min-h-0 flex-[1.15]">
            <CoachRail tab={coachTab} onTab={setCoachTab} />
          </div>
          <div className="min-h-0 flex-1">
            <ExecutionTicket />
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
