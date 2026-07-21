'use client'

import { useTerminalFocus } from './TerminalFocusProvider'

export function WatchlistSideList() {
  const {
    watchlists,
    activeWatchlistId,
    setActiveWatchlistId,
    selectMint,
    focusMint,
  } = useTerminalFocus()

  const active = watchlists.find((l) => l.id === activeWatchlistId) ?? watchlists[0]

  return (
    <div className="shrink-0 border-t border-[var(--tit-border)]">
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <p className="tit-label">Watchlists</p>
        <span className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">{watchlists.length}</span>
      </div>
      <ul className="max-h-24 overflow-y-auto px-1.5 pb-1.5">
        {watchlists.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => setActiveWatchlistId(l.id)}
              className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-[0.65rem] ${
                l.id === activeWatchlistId
                  ? 'bg-[var(--tit-accent)]/15 text-[var(--tit-accent-bright)]'
                  : 'text-[var(--tit-text-1)] hover:bg-[var(--tit-bg-2)]'
              }`}
            >
              <span className="truncate font-medium">{l.name}</span>
              <span className="tit-mono text-[0.55rem] text-[var(--tit-text-2)]">{l.items.length}</span>
            </button>
          </li>
        ))}
      </ul>
      {active && active.items.length > 0 ? (
        <ul className="max-h-16 overflow-y-auto border-t border-[var(--tit-border)] px-1.5 py-1">
          {active.items.slice(0, 6).map((item) => (
            <li key={item.mint}>
              <button
                type="button"
                onClick={() => selectMint(item.mint, item.symbol)}
                className={`w-full truncate rounded px-2 py-0.5 text-left tit-mono text-[0.55rem] ${
                  item.mint === focusMint
                    ? 'text-[var(--tit-accent-bright)]'
                    : 'text-[var(--tit-text-2)] hover:text-[var(--tit-text-0)]'
                }`}
              >
                {item.symbol || item.mint.slice(0, 6)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
