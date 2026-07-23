'use client'

/**
 * Market Intelligence Desk — real-time crypto intelligence center.
 * Status bar · Pulse cards · Heatmap · Live feed.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  buildMarketIntelligence,
  type LiveMarketQuotes,
  type MarketIntelligenceBundle,
} from '@/lib/trading-terminal/market-intelligence'
import { LiveIntelligenceFeed } from './LiveIntelligenceFeed'
import { MarketIntelStatusBar } from './MarketIntelStatusBar'
import { MarketPulseGrid } from './MarketPulseGrid'
import { TokenHeatmap } from './TokenHeatmap'
import { useTerminalFocus } from './TerminalFocusProvider'

async function fetchLiveQuotes(): Promise<LiveMarketQuotes | null> {
  try {
    const res = await fetch('/api/market/intelligence', { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as LiveMarketQuotes
  } catch {
    return null
  }
}

export function MarketIntelligenceDesk() {
  const { dataMode, selectMint, focusMint } = useTerminalFocus()
  const [live, setLive] = useState<LiveMarketQuotes | null>(null)
  const [loadingLive, setLoadingLive] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const q = await fetchLiveQuotes()
      if (!cancelled) {
        setLive(q)
        setLoadingLive(false)
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 45_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const bundle: MarketIntelligenceBundle = useMemo(
    () => buildMarketIntelligence(dataMode, live),
    [dataMode, live],
  )

  return (
    <div
      className="tit-area-mi flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--tit-bg-1)]"
      aria-label="Market Intelligence Center"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--tit-border)] bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[1.15rem] font-semibold tracking-tight text-[var(--tit-text-0)]">
              Market Intelligence
            </p>
            <p className="mt-1 text-[0.75rem] font-medium text-[var(--tit-text-1)]">
              Institutional desk · {bundle.methodNote}
            </p>
          </div>
          {loadingLive ? (
            <span className="text-[0.75rem] font-medium text-[var(--tit-text-2)]">Syncing feeds…</span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--tit-pos)]" />
              <span className="text-[0.75rem] font-semibold text-[var(--tit-pos)]">Feeds live</span>
            </span>
          )}
        </div>
      </div>

      <MarketIntelStatusBar metrics={bundle.status} />

      <MarketPulseGrid cards={bundle.pulse} />

      <div className="mi-main grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(300px,32%)]">
        <div className="min-h-0 overflow-hidden p-3 pt-0">
          <TokenHeatmap
            cells={bundle.heatmap}
            focusMint={focusMint}
            onSelect={(mint, symbol) => selectMint(mint, symbol)}
          />
        </div>
        <div className="min-h-0 overflow-hidden border-t border-[var(--tit-border)] lg:border-l lg:border-t-0">
          <LiveIntelligenceFeed
            events={bundle.feed}
            methodNote={bundle.methodNote}
            onSelectToken={(mint, symbol) => selectMint(mint, symbol)}
          />
        </div>
      </div>
    </div>
  )
}
