'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { useSignalFeed } from '@/lib/signals-dashboard/use-signal-feed'
import { AiIntelligenceWorkstation } from './AiIntelligenceWorkstation'
import { IconRail, type TerminalPane } from './IconRail'
import { KeyboardHelp } from './KeyboardHelp'
import { PrimaryChart } from './PrimaryChart'
import { PortfolioIntelligenceDesk } from './portfolio/PortfolioIntelligenceDesk'
import { TerminalFocusProvider, useTerminalFocus } from './TerminalFocusProvider'
import { TerminalStatusBar } from './TerminalStatusBar'
import { TerminalTopBar } from './TerminalTopBar'
import { WatchlistPanel } from './WatchlistPanel'
import { useTerminalKeyboard } from './useTerminalKeyboard'

/**
 * Institutional Intelligence Terminal —
 * Watchlist · Primary chart · Coach AI · Portfolio Intelligence desk.
 */
function TerminalWorkspace() {
  const feed = useSignalFeed({ subjectType: 'token' })
  const allRows = useMemo(() => {
    return feed.orderedIds
      .map((id) => feed.signals.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s?.contractAddress))
      .slice(0, 120)
  }, [feed.orderedIds, feed.signals])

  const [helpOpen, setHelpOpen] = useState(false)
  const [pane, setPane] = useState<TerminalPane>('charts')

  const chartsRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const portRef = useRef<HTMLDivElement>(null)

  useTerminalKeyboard(allRows, {
    onTabVerdict: () => setPane('coach'),
    onTabRecord: () => setPane('coach'),
    onTabBrief: () => setPane('coach'),
    onTabBehavior: () => setPane('coach'),
    onTabOutcomes: () => setPane('coach'),
    onToggleHelp: () => setHelpOpen((v) => !v),
    onCloseOverlays: () => setHelpOpen(false),
    helpOpen,
  })

  const {
    hydrated,
    setSolPriceUsd,
    dataMode,
    selectMint,
    watchlists,
    activeWatchlistId,
    addToWatchlist,
    removeFromWatchlist,
  } = useTerminalFocus()

  const watchedMints = useMemo(() => {
    const active = watchlists.find((l) => l.id === activeWatchlistId) ?? watchlists[0]
    return new Set((active?.items ?? []).map((i) => i.mint))
  }, [watchlists, activeWatchlistId])

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

  const portDesk = pane === 'portfolio'

  const onPane = (p: TerminalPane) => {
    setPane(p)
    if (p === 'help') {
      setHelpOpen(true)
      return
    }
    if (p === 'portfolio') {
      portRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }
    if (p === 'charts' || p === 'coach') {
      chartsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    if (
      p === 'watchlists' ||
      p === 'discover' ||
      p === 'opportunities' ||
      p === 'intel' ||
      p === 'alerts'
    ) {
      leftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  if (!hydrated) {
    return (
      <div className="tit-shell flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="tit-skeleton h-10 w-10 rounded-[10px]" />
          <div className="tit-skeleton h-3 w-40" />
          <p className="tit-mono text-[0.65rem] uppercase tracking-[0.14em] text-[var(--tit-text-2)]">
            Initializing desk…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`tit-shell tit-shell-grid${portDesk ? ' tit-shell-grid-port' : ''}`}>
      <TerminalTopBar onHelp={() => setHelpOpen(true)} />
      <IconRail active={pane} onSelect={onPane} />

      {portDesk ? (
        <div ref={portRef} className="tit-area-port min-h-0 overflow-hidden">
          <PortfolioIntelligenceDesk
            mode={dataMode}
            watchedMints={watchedMints}
            onFocusMint={(mint, symbol) => selectMint(mint, symbol)}
            onToggleWatchlist={(holding, currentlyWatched) => {
              if (currentlyWatched) removeFromWatchlist(holding.mint)
              else {
                addToWatchlist({
                  mint: holding.mint,
                  symbol: holding.symbol,
                  name: holding.name,
                })
              }
            }}
          />
        </div>
      ) : (
        <>
          <div ref={leftRef} className="tit-area-left min-h-0 overflow-hidden">
            <WatchlistPanel />
          </div>

          <div
            ref={chartsRef}
            className="tit-area-center flex min-h-0 min-w-0 flex-col overflow-hidden p-1.5"
          >
            <PrimaryChart />
          </div>

          <div className="tit-area-coach min-h-0 overflow-hidden">
            <AiIntelligenceWorkstation />
          </div>
        </>
      )}

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
