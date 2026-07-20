'use client'

import { useMemo, useState } from 'react'
import { useSignalFeed } from '@/lib/signals-dashboard/use-signal-feed'
import { loadWorkspace } from '@/lib/trading-terminal/workspace-storage'
import { DiscoverRail } from './DiscoverRail'
import { ChartGrid } from './ChartGrid'
import { ExecutionTicket } from './ExecutionTicket'
import { PortfolioStrip } from './PortfolioStrip'
import { TerminalHeader } from './TerminalHeader'
import { WatchlistDock } from './WatchlistDock'
import { CoachRail, useCoachRailTab } from './CoachRail'
import { KeyboardHelp } from './KeyboardHelp'
import { TerminalFocusProvider, useTerminalFocus } from './TerminalFocusProvider'
import { useTerminalKeyboard } from './useTerminalKeyboard'

function SessionHabitStrip() {
  const tip = useMemo(() => {
    const ws = loadWorkspace()
    if (!ws?.updatedAt) return 'First session — set a chart layout; it restores on reload.'
    const ageH = (Date.now() - Date.parse(ws.updatedAt)) / 3_600_000
    if (!Number.isFinite(ageH)) return null
    if (ageH < 1) return `Workspace saved ${Math.round(ageH * 60)}m ago · focus ${ws.focusSymbol || '—'}`
    if (ageH < 48) return `Overnight: workspace from ${ageH.toFixed(0)}h ago · ${ws.focusSymbol || 'no focus'}`
    return `Last workspace save ${ageH.toFixed(0)}h ago · ${ws.slots.filter((s) => s.mint).length}/${ws.chartMode} charts filled`
  }, [])

  if (!tip) return null
  return (
    <div className="tit-panel flex h-7 shrink-0 items-center px-3">
      <p className="tit-mono truncate text-[0.6rem] text-[var(--tit-text-2)]">{tip}</p>
    </div>
  )
}

function TerminalWorkspace() {
  const feed = useSignalFeed({ subjectType: 'token' })
  const rows = useMemo(() => {
    return feed.orderedIds
      .map((id) => feed.signals.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s?.contractAddress))
      .slice(0, 80)
  }, [feed.orderedIds, feed.signals])

  const [coachTab, setCoachTab] = useCoachRailTab()
  const [helpOpen, setHelpOpen] = useState(false)

  useTerminalKeyboard(rows, {
    onTabVerdict: () => setCoachTab('verdict'),
    onTabRecord: () => setCoachTab('record'),
    onTabBrief: () => setCoachTab('brief'),
    onTabBehavior: () => setCoachTab('behavior'),
    onTabOutcomes: () => setCoachTab('outcomes'),
    onToggleHelp: () => setHelpOpen((v) => !v),
    onCloseOverlays: () => {
      setHelpOpen(false)
    },
    helpOpen,
  })

  const { chartMode, discoverCollapsed, hydrated } = useTerminalFocus()
  const discoverWidth = discoverCollapsed ? 40 : chartMode >= 4 ? 200 : 280

  if (!hydrated) {
    return (
      <div className="tit-shell flex h-[calc(100vh-2.75rem)] items-center justify-center p-4">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-8 w-48 animate-pulse rounded bg-[var(--tit-bg-3)]" />
          <p className="text-xs text-[var(--tit-text-2)]">Restoring workspace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="tit-shell flex h-[calc(100vh-2.75rem)] flex-col gap-2 p-2">
      <TerminalHeader onHelp={() => setHelpOpen(true)} />
      <SessionHabitStrip />

      <div className="flex min-h-0 flex-1 gap-2">
        <div style={{ width: discoverWidth }} className="flex shrink-0">
          <DiscoverRail
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
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <ChartGrid />
          <WatchlistDock />
        </div>

        <div className="flex w-[360px] shrink-0 flex-col gap-2">
          <div className="min-h-0 flex-[1.2]">
            <CoachRail tab={coachTab} onTab={setCoachTab} />
          </div>
          <div className="min-h-0 flex-1">
            <ExecutionTicket />
          </div>
        </div>
      </div>

      <PortfolioStrip />
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
