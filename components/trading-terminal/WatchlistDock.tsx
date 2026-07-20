'use client'

import { Star, Trash2 } from 'lucide-react'
import { TIT_DND_MIME } from '@/lib/trading-terminal/constants'
import { encodeTitDrag } from '@/lib/trading-terminal/dnd'
import { useTerminalFocus } from './TerminalFocusProvider'

function truncMint(m: string) {
  return m.length < 10 ? m : `${m.slice(0, 4)}…${m.slice(-4)}`
}

export function WatchlistDock() {
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
  } = useTerminalFocus()

  const active = watchlists.find((l) => l.id === activeWatchlistId) ?? watchlists[0]
  const onList = Boolean(active?.items.some((i) => i.mint === focusMint))

  return (
    <section className="tit-panel flex h-[140px] shrink-0 flex-col overflow-hidden" aria-label="Watchlist">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-2 py-1.5">
        <p className="tit-label">Watchlist</p>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {watchlists.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setActiveWatchlistId(l.id)}
              className={`tit-mono shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] ${
                l.id === activeWatchlistId
                  ? 'bg-[var(--tit-ember)] text-white'
                  : 'bg-[var(--tit-bg-2)] text-[var(--tit-text-1)]'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={cycleWatchlist}
          className="tit-mono text-[0.55rem] text-[var(--tit-text-2)]"
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
          className="tit-mono text-[0.55rem] text-[var(--tit-text-1)] hover:text-[var(--tit-text-0)]"
        >
          +
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
          className="rounded p-1 text-[var(--tit-text-1)] hover:text-[var(--tit-ember)] disabled:opacity-40"
          aria-label={onList ? 'Remove from watchlist' : 'Add focus to watchlist'}
          title={onList ? 'Remove from list' : 'Star focus token'}
        >
          <Star
            className="h-3.5 w-3.5"
            fill={onList ? 'var(--tit-ember)' : 'none'}
            stroke={onList ? 'var(--tit-ember)' : 'currentColor'}
          />
        </button>
      </div>

      {!active || active.items.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[var(--tit-text-1)]">
          Empty list. Star the focused token or drag Discover rows onto charts, then star.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
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
                  className={`flex w-full items-center gap-2 px-2 py-1 text-left text-xs ${
                    activeRow ? 'tit-row-active' : 'hover:bg-[var(--tit-bg-2)]'
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left"
                    onClick={() => selectMint(item.mint, item.symbol)}
                  >
                    <span className="font-medium text-[var(--tit-text-0)]">{item.symbol}</span>
                    <span className="tit-mono ml-2 text-[0.55rem] text-[var(--tit-text-2)]">
                      {truncMint(item.mint)}
                    </span>
                  </button>
                  {item.lastVerdict ? (
                    <span className="tit-mono shrink-0 text-[0.55rem] uppercase text-[var(--tit-text-2)]">
                      {item.lastVerdict}
                    </span>
                  ) : (
                    <span className="tit-mono shrink-0 text-[0.55rem] text-[var(--tit-text-2)]">—</span>
                  )}
                  {typeof item.lastRiskScore === 'number' ? (
                    <span className="tit-mono shrink-0 text-[0.55rem] text-[var(--tit-text-2)]">
                      r{item.lastRiskScore}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="rounded p-0.5 text-[var(--tit-text-2)] hover:text-[var(--tit-neg)]"
                    aria-label="Remove"
                    onClick={() => removeFromWatchlist(item.mint)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
