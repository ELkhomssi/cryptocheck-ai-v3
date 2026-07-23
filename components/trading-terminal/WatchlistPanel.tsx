'use client'

/**
 * Left watchlist desk — markets universe + starred book.
 */

import { useMemo } from 'react'
import { Plus, Star, Trash2 } from 'lucide-react'
import { TIT_DND_MIME } from '@/lib/trading-terminal/constants'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import { encodeTitDrag } from '@/lib/trading-terminal/dnd'
import { resolveIntelligence } from '@/lib/trading-terminal/engines/resolve-intelligence'
import { useTerminalFocus } from './TerminalFocusProvider'
import { useTerminalPortfolio } from './MiniPortfolioCard'

function truncMint(m: string) {
  return m.length < 10 ? m : `${m.slice(0, 4)}…${m.slice(-4)}`
}

function verdictTone(v?: string): string {
  if (!v) return 'text-[var(--tit-text-2)]'
  if (v === 'SAFE') return 'text-[var(--tit-pos)]'
  if (v === 'DANGER' || v === 'BLOCKED' || v === 'HIGH_RISK') return 'text-[var(--tit-neg)]'
  return 'text-[var(--tit-warn)]'
}

export function WatchlistPanel() {
  const {
    watchlists,
    activeWatchlistId,
    setActiveWatchlistId,
    selectMint,
    focusMint,
    removeFromWatchlist,
    addToWatchlist,
    createWatchlist,
    focusSymbol,
    scan,
    cycleWatchlist,
    dataMode,
  } = useTerminalFocus()
  const { data: portfolio } = useTerminalPortfolio()

  const active = watchlists.find((l) => l.id === activeWatchlistId) ?? watchlists[0]
  const onList = Boolean(active?.items.some((i) => i.mint === focusMint))

  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])
  const markets =
    dataMode === 'demo' && snap.discover.status === 'ready' ? snap.discover.data.slice(0, 10) : []

  const intel = useMemo(
    () =>
      resolveIntelligence({
        mode: dataMode,
        portfolioSummary: portfolio?.summary ?? null,
        focusMint,
      }),
    [dataMode, portfolio?.summary, focusMint],
  )

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-[var(--tit-border)] bg-[var(--tit-bg-1)]"
      aria-label="Watchlist"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--tit-border)] px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="tit-display text-[0.9375rem] font-semibold tracking-tight">Watchlist</p>
          <p className="tit-mono mt-0.5 text-[0.625rem] uppercase tracking-[0.1em] text-[var(--tit-text-2)]">
            Desk universe
          </p>
        </div>
        <button
          type="button"
          onClick={cycleWatchlist}
          className="tit-btn-ghost tit-mono px-2 py-1.5 text-[0.625rem]"
          title="Cycle list (W)"
        >
          W
        </button>
        <button
          type="button"
          onClick={() => {
            const name = window.prompt('New watchlist name')
            if (name?.trim()) createWatchlist(name.trim())
          }}
          className="tit-btn-ghost p-2"
          aria-label="New watchlist"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={!focusMint || focusMint.length < 32}
          onClick={() => {
            if (!focusMint) return
            if (onList) removeFromWatchlist(focusMint)
            else
              addToWatchlist({
                mint: focusMint,
                symbol: focusSymbol || scan?.symbol || focusMint.slice(0, 6),
                lastVerdict: scan?.verdict,
                lastRiskScore: scan?.riskScore,
              })
          }}
          className="tit-btn-ghost p-2 disabled:opacity-40"
          aria-label={onList ? 'Remove from watchlist' : 'Star focus'}
        >
          <Star
            className="h-3.5 w-3.5"
            fill={onList ? 'var(--tit-accent)' : 'none'}
            stroke={onList ? 'var(--tit-accent)' : 'currentColor'}
          />
        </button>
      </div>

      {/* List tabs */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--tit-border-subtle)] px-3 py-2">
        {watchlists.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setActiveWatchlistId(l.id)}
            className={`tit-mono shrink-0 rounded-[6px] px-2.5 py-1.5 text-[0.6875rem] font-semibold transition-colors duration-[var(--tit-motion)] ${
              l.id === activeWatchlistId
                ? 'bg-[var(--tit-bg-3)] text-[var(--tit-text-0)]'
                : 'text-[var(--tit-text-2)] hover:bg-white/[0.04] hover:text-[var(--tit-text-0)]'
            }`}
          >
            {l.name}
            <span className="ml-1.5 opacity-55">{l.items.length}</span>
          </button>
        ))}
      </div>

      <div className="tit-scroll min-h-0 flex-1 overflow-y-auto">
        {/* Starred */}
        <section className="border-b border-[var(--tit-border-subtle)] px-2 py-3">
          <p className="tit-section-title mb-2 px-2">Starred</p>
          {!active || active.items.length === 0 ? (
            <p className="px-2 py-3 text-[0.75rem] text-[var(--tit-text-2)]">
              Star the focused symbol to pin it here.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {active.items.map((item) => {
                const activeRow = item.mint === focusMint
                return (
                  <li key={item.mint}>
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          TIT_DND_MIME,
                          encodeTitDrag({ mint: item.mint, symbol: item.symbol }),
                        )
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      className={`group flex w-full items-center gap-2 rounded-[6px] px-2 py-2.5 transition-colors duration-[var(--tit-motion)] ${
                        activeRow
                          ? 'bg-[var(--tit-bg-3)]'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => selectMint(item.mint, item.symbol)}
                      >
                        <span className="block truncate text-[0.8125rem] font-semibold text-[var(--tit-text-0)]">
                          {item.symbol}
                        </span>
                        <span className="tit-mono text-[0.625rem] text-[var(--tit-text-2)]">
                          {truncMint(item.mint)}
                        </span>
                      </button>
                      <span
                        className={`tit-mono shrink-0 text-[0.625rem] uppercase ${verdictTone(item.lastVerdict)}`}
                      >
                        {item.lastVerdict?.slice(0, 6) ?? '—'}
                      </span>
                      <button
                        type="button"
                        className="rounded p-1 text-[var(--tit-text-2)] opacity-0 transition-opacity hover:text-[var(--tit-neg)] group-hover:opacity-100"
                        aria-label="Remove"
                        onClick={() => removeFromWatchlist(item.mint)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Opportunities */}
        {intel.opportunities.length > 0 ? (
          <section className="border-b border-[var(--tit-border-subtle)] px-2 py-3">
            <p className="tit-section-title mb-2 px-2">Opportunities</p>
            <ul className="space-y-0.5">
              {intel.opportunities.slice(0, 5).map((o) => (
                <li key={o.mint}>
                  <button
                    type="button"
                    onClick={() => selectMint(o.mint, o.symbol)}
                    className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-2.5 text-left transition-colors duration-[var(--tit-motion)] ${
                      o.mint === focusMint
                        ? 'bg-[var(--tit-bg-3)]'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="tit-mono text-[0.8125rem] font-semibold text-[var(--tit-text-0)]">
                      {o.symbol}
                    </span>
                    <span className="tit-mono ml-auto text-[0.6875rem] font-semibold text-[var(--tit-pos)]">
                      {o.convictionScore}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Markets tape */}
        {markets.length > 0 ? (
          <section className="px-2 py-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="tit-section-title">Markets</p>
              {dataMode === 'demo' ? <span className="tit-sample-tag">Sample</span> : null}
            </div>
            <ul className="space-y-0.5">
              {markets.map((m) => (
                <li key={m.mint}>
                  <button
                    type="button"
                    onClick={() => selectMint(m.mint, m.symbol)}
                    className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-2.5 text-left transition-colors duration-[var(--tit-motion)] ${
                      m.mint === focusMint
                        ? 'bg-[var(--tit-bg-3)]'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-semibold text-[var(--tit-text-0)]">
                        {m.symbol}
                      </span>
                      <span className="tit-mono text-[0.625rem] text-[var(--tit-text-2)]">
                        {m.priceUsd > 0
                          ? `$${m.priceUsd < 1 ? m.priceUsd.toPrecision(3) : m.priceUsd.toFixed(2)}`
                          : '—'}
                      </span>
                    </span>
                    <span
                      className={`tit-mono text-[0.6875rem] font-semibold ${
                        m.changePct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                      }`}
                    >
                      {m.changePct >= 0 ? '+' : ''}
                      {m.changePct.toFixed(1)}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : dataMode === 'live' ? (
          <section className="px-4 py-4">
            <p className="text-[0.75rem] text-[var(--tit-text-2)]">
              Live market tape connects when discover feed is available. Star symbols or search a CA.
            </p>
          </section>
        ) : null}
      </div>
    </aside>
  )
}
