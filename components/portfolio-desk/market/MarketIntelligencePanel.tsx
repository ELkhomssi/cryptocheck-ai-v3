'use client'

/**
 * Market Intelligence — AI Market Analyst (not a dashboard).
 * Default: briefing only. Raw screener / feeds only after the analyst finishes
 * and the user asks — never first.
 * Presentation only. Existing /api/market/screener + /api/market/intelligence.
 */

import { Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ScreenerRow } from '@/lib/providers/types'
import { buildMarketAnalystBrief } from '@/lib/portfolio-desk/market-analyst'
import { MarketAnalystView } from '@/components/portfolio-desk/market/MarketAnalystView'
import { MarketFeeds } from '@/components/portfolio-desk/market/MarketFeeds'
import { ScreenerPanel } from '@/components/portfolio-desk/screener/ScreenerPanel'
import { WatchlistPanel } from '@/components/portfolio-desk/watchlist/WatchlistPanel'

type DeskMode = 'briefing' | 'raw'

type ScreenerPayload = {
  rows?: ScreenerRow[]
  available?: boolean
  source?: string
  error?: string
}

async function fetchScreenerSample(): Promise<ScreenerPayload> {
  const q = new URLSearchParams({
    sort: 'volume',
    order: 'desc',
    offset: '0',
    limit: '48',
  })
  const res = await fetch(`/api/market/screener?${q}`, { cache: 'no-store' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { rows: [], available: false, error: body.error || 'screener unavailable' }
  }
  return (await res.json()) as ScreenerPayload
}

async function fetchQuotes(): Promise<
  import('@/lib/portfolio-desk/market-analyst').MarketMacroQuotes | null
> {
  const res = await fetch('/api/market/intelligence', { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as import('@/lib/portfolio-desk/market-analyst').MarketMacroQuotes
}

export function MarketIntelligencePanel({
  initialTab = 'analyst',
  onSelectMint,
}: {
  initialTab?: string
  onSelectMint?: (mint: string) => void
}) {
  const wantRawFirst =
    initialTab === 'tracked' ||
    initialTab === 'watchlist' ||
    initialTab === 'discovery' ||
    initialTab === 'screener'
  const [mode, setMode] = useState<DeskMode>(wantRawFirst ? 'raw' : 'briefing')
  const [rawTab, setRawTab] = useState<'discovery' | 'tracked' | 'structure'>(() =>
    initialTab === 'tracked' || initialTab === 'watchlist'
      ? 'tracked'
      : initialTab === 'structure' ||
          initialTab === 'whales' ||
          initialTab === 'smart' ||
          initialTab === 'liquidity' ||
          initialTab === 'dex'
        ? 'structure'
        : 'discovery',
  )

  const screenerQ = useQuery({
    queryKey: ['market-analyst-screener'],
    queryFn: fetchScreenerSample,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const quotesQ = useQuery({
    queryKey: ['market-analyst-quotes'],
    queryFn: fetchQuotes,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const loading = screenerQ.isLoading && quotesQ.isLoading

  const brief = useMemo(
    () =>
      buildMarketAnalystBrief({
        screenerRows: screenerQ.data?.rows ?? [],
        quotes: quotesQ.data ?? null,
        available: screenerQ.data?.available !== false,
        source: screenerQ.data?.source ?? null,
        loading,
      }),
    [screenerQ.data, quotesQ.data, loading],
  )

  if (mode === 'briefing') {
    return (
      <MarketAnalystView
        brief={brief}
        loading={loading}
        onSelectMint={onSelectMint}
        onOpenRaw={() => setMode('raw')}
      />
    )
  }

  return (
    <section className="ma-shell">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="mc-talk-quiet-link" onClick={() => setMode('briefing')}>
          ← Back to analyst briefing
        </button>
        <div className="pd-tabs" style={{ flexWrap: 'wrap' }}>
          {(
            [
              ['discovery', 'Discovery'],
              ['tracked', 'Tracked'],
              ['structure', 'Structure'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`pd-tab${rawTab === id ? ' is-active' : ''}`}
              onClick={() => setRawTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rawTab === 'discovery' ? (
        <Suspense
          fallback={
            <div className="pd-panel" style={{ padding: 18 }}>
              <div className="pd-skeleton" style={{ height: 36 }} />
            </div>
          }
        >
          <ScreenerPanel onSelectMint={onSelectMint} />
        </Suspense>
      ) : null}
      {rawTab === 'tracked' ? <WatchlistPanel /> : null}
      {rawTab === 'structure' ? (
        <div className="pd-panel" style={{ padding: 16 }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--pd-text-dim)' }}>
            Raw supporting feeds — only after the analyst briefing.
          </p>
          <MarketFeeds />
        </div>
      ) : null}
    </section>
  )
}
