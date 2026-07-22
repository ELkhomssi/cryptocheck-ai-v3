'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { useSignalFeed } from '@/lib/signals-dashboard/use-signal-feed'
import { AiIntelligenceWorkstation } from './AiIntelligenceWorkstation'
import { AlphaDiscoveryDesk } from './alpha/AlphaDiscoveryDesk'
import { AiCopilotDesk } from './copilot/AiCopilotDesk'
import { IconRail, type TerminalPane } from './IconRail'
import { KeyboardHelp } from './KeyboardHelp'
import { MarketIntelligenceDesk } from './MarketIntelligenceDesk'
import { PrimaryChart } from './PrimaryChart'
import { PortfolioIntelligenceDesk } from './portfolio/PortfolioIntelligenceDesk'
import { TerminalFocusProvider, useTerminalFocus } from './TerminalFocusProvider'
import { TerminalStatusBar } from './TerminalStatusBar'
import { TerminalTopBar } from './TerminalTopBar'
import { WatchlistPanel } from './WatchlistPanel'
import { WhaleIntelligenceDesk } from './whale/WhaleIntelligenceDesk'
import { useTerminalKeyboard } from './useTerminalKeyboard'

type FullDesk = 'mi' | 'whale' | 'alpha' | 'port' | 'copilot' | null

function resolveFullDesk(pane: TerminalPane): FullDesk {
  if (pane === 'copilot') return 'copilot'
  if (pane === 'intel' || pane === 'alerts') return 'mi'
  if (pane === 'whale') return 'whale'
  if (pane === 'opportunities' || pane === 'discover') return 'alpha'
  if (pane === 'portfolio') return 'port'
  return null
}

function shellClassFor(desk: FullDesk): string {
  switch (desk) {
    case 'mi':
      return 'tit-shell tit-shell-grid-mi'
    case 'whale':
      return 'tit-shell tit-shell-grid tit-shell-grid-whale'
    case 'alpha':
      return 'tit-shell tit-shell-grid tit-shell-grid-alpha'
    case 'port':
      return 'tit-shell tit-shell-grid tit-shell-grid-port'
    case 'copilot':
      return 'tit-shell tit-shell-grid tit-shell-grid-copilot'
    default:
      return 'tit-shell tit-shell-grid'
  }
}

/**
 * Institutional Intelligence Terminal —
 * Chart · AI Copilot · Market · Whale · Alpha · Portfolio.
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

  const fullDesk = resolveFullDesk(pane)

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
    if (resolveFullDesk(p)) return
    if (p === 'charts' || p === 'coach') {
      chartsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    if (p === 'watchlists') {
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
    <div className={shellClassFor(fullDesk)}>
      <TerminalTopBar onHelp={() => setHelpOpen(true)} />
      <IconRail
        active={pane === 'discover' ? 'opportunities' : pane}
        onSelect={onPane}
      />

      {fullDesk === 'copilot' ? (
        <div className="tit-area-copilot min-h-0 overflow-hidden">
          <AiCopilotDesk mode={dataMode} />
        </div>
      ) : fullDesk === 'mi' ? (
        <div className="tit-area-mi-main min-h-0 overflow-hidden">
          <MarketIntelligenceDesk />
        </div>
      ) : fullDesk === 'whale' ? (
        <div className="tit-area-whale min-h-0 overflow-hidden">
          <WhaleIntelligenceDesk mode={dataMode} />
        </div>
      ) : fullDesk === 'alpha' ? (
        <div className="tit-area-alpha min-h-0 overflow-hidden">
          <AlphaDiscoveryDesk
            mode={dataMode}
            onFocusMint={(mint, symbol) => selectMint(mint, symbol)}
          />
        </div>
      ) : fullDesk === 'port' ? (
        <div className="tit-area-port min-h-0 overflow-hidden">
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
                  lastVerdict: holding.verdict ?? undefined,
                  lastRiskScore: holding.riskScore,
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
