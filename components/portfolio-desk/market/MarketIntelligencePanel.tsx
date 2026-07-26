'use client'

/**
 * Market Intelligence — Discovery (screener) + Tracked (watchlist) + market structure tabs.
 * Reuses existing ScreenerPanel / WatchlistPanel / MarketFeeds — no parallel fetch paths.
 */

import { Suspense, useState } from 'react'
import { MarketFeeds } from '@/components/portfolio-desk/market/MarketFeeds'
import { ScreenerPanel } from '@/components/portfolio-desk/screener/ScreenerPanel'
import { WatchlistPanel } from '@/components/portfolio-desk/watchlist/WatchlistPanel'

const TABS = [
  { id: 'discovery', label: 'Discovery' },
  { id: 'tracked', label: 'Tracked' },
  { id: 'whales', label: 'Whales' },
  { id: 'smart', label: 'Smart Money' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'dex', label: 'DEX Activity' },
  { id: 'narratives', label: 'Narratives' },
] as const

type TabId = (typeof TABS)[number]['id']

export function MarketIntelligencePanel({
  initialTab = 'discovery',
  onSelectMint,
}: {
  initialTab?: TabId | string
  onSelectMint?: (mint: string) => void
}) {
  const start = TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : 'discovery'
  const [tab, setTab] = useState<TabId>(start)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

      {tab === 'whales' || tab === 'smart' || tab === 'liquidity' || tab === 'dex' ? (
        <div className="pd-panel" style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>
            {tab === 'whales'
              ? 'Whale activity'
              : tab === 'smart'
                ? 'Smart money'
                : tab === 'liquidity'
                  ? 'Liquidity structure'
                  : 'DEX activity'}
          </h3>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--pd-text-dim)' }}>
            Findings surface as market events — not employee headlines. Live feeds below are
            independently cached provider data.
          </p>
          <MarketFeeds />
        </div>
      ) : null}

      {tab === 'narratives' ? (
        <div className="pd-empty pd-panel">
          <h3>Narratives unavailable</h3>
          <p>
            News / social narrative providers are not configured yet. Nothing is fabricated —
            configure a news source to unlock this tab.
          </p>
        </div>
      ) : null}
    </section>
  )
}
