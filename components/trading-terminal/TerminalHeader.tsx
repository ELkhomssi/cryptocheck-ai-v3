'use client'

import { useEffect, useRef, useState } from 'react'
import { CHART_MODES, type ChartMode } from '@/lib/trading-terminal/constants'
import { useTerminalFocus } from './TerminalFocusProvider'

export function TerminalHeader({ onHelp }: { onHelp?: () => void }) {
  const {
    chartMode,
    setChartMode,
    discoverCollapsed,
    setDiscoverCollapsed,
    coachCollapsed,
    setCoachCollapsed,
    selectMint,
    focusMint,
    focusSymbol,
  } = useTerminalFocus()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === '/' && !e.shiftKey && !(e.target as HTMLElement)?.closest('input, textarea')) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="tit-panel flex h-12 shrink-0 items-center gap-3 px-3">
      <div className="min-w-0">
        <p className="text-[0.7rem] font-semibold tracking-tight text-[var(--tit-text-0)]">
          CryptoCheck <span className="text-[var(--tit-ember)]">Terminal</span>
        </p>
        <p className="truncate text-[0.55rem] text-[var(--tit-text-2)]">
          Discover · Analyze · Trade · Improve
        </p>
      </div>

      <form
        className="flex min-w-0 flex-1 items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const q = query.trim()
          if (q.length >= 32) selectMint(q)
        }}
      >
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Mint / search (⌘K)"
          className="tit-mono h-8 min-w-0 flex-1 rounded border border-white/10 bg-[var(--tit-bg-0)] px-2 text-xs text-[var(--tit-text-0)] outline-none focus:border-[var(--tit-ember)]"
          aria-label="Symbol search"
        />
        <button type="submit" className="tit-btn-ember h-8 px-3">
          Load
        </button>
      </form>

      <div className="flex items-center gap-1" role="group" aria-label="Chart mode">
        {CHART_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setChartMode(m as ChartMode)}
            className={`tit-mono h-7 w-7 rounded text-[0.65rem] ${
              chartMode === m
                ? 'bg-[var(--tit-ember)] text-white'
                : 'bg-[var(--tit-bg-2)] text-[var(--tit-text-1)]'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setDiscoverCollapsed(!discoverCollapsed)}
        className="hidden rounded border border-white/10 px-2 py-1 text-[0.65rem] text-[var(--tit-text-1)] lg:inline"
      >
        Discover
      </button>
      <button
        type="button"
        onClick={() => setCoachCollapsed(!coachCollapsed)}
        className="hidden rounded border border-white/10 px-2 py-1 text-[0.65rem] text-[var(--tit-text-1)] lg:inline"
      >
        Coach
      </button>
      <button
        type="button"
        onClick={() => onHelp?.()}
        className="tit-mono h-7 w-7 rounded border border-white/10 text-[0.7rem] text-[var(--tit-text-1)] hover:text-[var(--tit-text-0)]"
        aria-label="Keyboard help"
        title="Keyboard help (?)"
      >
        ?
      </button>

      {focusMint ? (
        <span className="tit-mono hidden max-w-[8rem] truncate text-[0.6rem] text-[var(--tit-text-2)] xl:inline">
          {focusSymbol}
        </span>
      ) : null}
    </header>
  )
}
