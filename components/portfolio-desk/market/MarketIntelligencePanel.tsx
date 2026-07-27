'use client'

/**
 * Market Intelligence — AI Market Analyst (Phase 17.2).
 * Presentation only. Reuses existing /api/market/screener + /api/market/intelligence
 * and existing desk panels for evidence / raw metrics below the fold.
 */

import { Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ScreenerRow } from '@/lib/providers/types'
import { buildMarketAnalystBrief } from '@/lib/portfolio-desk/market-analyst'
import { MarketAnalystView } from '@/components/portfolio-desk/market/MarketAnalystView'
import { MarketFeeds } from '@/components/portfolio-desk/market/MarketFeeds'
import { ScreenerPanel } from '@/components/portfolio-desk/screener/ScreenerPanel'
import { WatchlistPanel } from '@/components/portfolio-desk/watchlist/WatchlistPanel'

const TABS = [
  { id: 'analyst', label: 'Analyst' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'tracked', label: 'Tracked' },
  { id: 'structure', label: 'Structure' },
] as const

type TabId = (typeof TABS)[number]['id']

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

async function fetchQuotes(): Promise<import('@/lib/portfolio-desk/market-analyst').MarketMacroQuotes | null> {
  const res = await fetch('/api/market/intelligence', { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as import('@/lib/portfolio-desk/market-analyst').MarketMacroQuotes
}

function normalizeInitialTab(initialTab?: string): TabId {
  if (initialTab === 'tracked' || initialTab === 'watchlist') return 'tracked'
  if (initialTab === 'discovery' || initialTab === 'screener') return 'discovery'
  if (
    initialTab === 'whales' ||
    initialTab === 'smart' ||
    initialTab === 'liquidity' ||
    initialTab === 'dex' ||
    initialTab === 'narratives' ||
    initialTab === 'structure'
  ) {
    return 'structure'
  }
  return 'analyst'
}

export function MarketIntelligencePanel({
  initialTab = 'analyst',
  onSelectMint,
}: {
  initialTab?: TabId | string
  onSelectMint?: (mint: string) => void
}) {
  const [tab, setTab] = useState<TabId>(() => normalizeInitialTab(initialTab))

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

  const brief = useMemo(
    () =>
      buildMarketAnalystBrief({
        screenerRows: screenerQ.data?.rows ?? [],
        quotes: quotesQ.data ?? null,
        available: screenerQ.data?.available !== false,
        source: screenerQ.data?.source ?? null,
      }),
    [screenerQ.data, quotesQ.data],
  )

  const loading = screenerQ.isLoading && quotesQ.isLoading

  return (
    <section className="ma-shell">
      <div className="pd-tabs" style={{ flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pd-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'analyst' ? (
        <>
          <MarketAnalystView
            brief={brief}
            loading={loading}
            onSelectMint={onSelectMint}
          />
          <details className="ma-raw-desk">
            <summary>Raw metrics &amp; discovery tables</summary>
            <p className="ma-soft" style={{ marginBottom: 12 }}>
              Evidence desk — tables stay below the analyst brief on purpose.
            </p>
            <Suspense
              fallback={
                <div className="pd-panel" style={{ padding: 18 }}>
                  <div className="pd-skeleton" style={{ height: 36 }} />
                </div>
              }
            >
              <ScreenerPanel onSelectMint={onSelectMint} />
            </Suspense>
          </details>
        </>
      ) : null}

      {tab === 'discovery' ? (
        <Suspense
          fallback={
            <div className="pd-panel" style={{ padding: 18 }}>
              <div className="pd-skeleton" style={{ height: 36, marginBottom: 10 }} />
              <div className="pd-skeleton" style={{ height: 36 }} />
            </div>
          }
        >
          <ScreenerPanel onSelectMint={onSelectMint} />
        </Suspense>
      ) : null}

      {tab === 'tracked' ? <WatchlistPanel /> : null}

      {tab === 'structure' ? (
        <div className="pd-panel" style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Market structure</h3>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--pd-text-dim)' }}>
            Supporting feeds for the analyst brief — gainers, losers, smart money, volume. Live
            provider data only.
          </p>
          <MarketFeeds />
        </div>
      ) : null}
    </section>
  )
}
