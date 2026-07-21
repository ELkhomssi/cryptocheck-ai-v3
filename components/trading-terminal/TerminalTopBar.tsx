'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, ChevronDown, Search } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import { useTerminalFocus } from './TerminalFocusProvider'
import { useTerminalPortfolio } from './MiniPortfolioCard'

export function TerminalTopBar({ onHelp }: { onHelp?: () => void }) {
  const { selectMint, focusSymbol, dataMode, setDataMode, portfolioTotalUsd } = useTerminalFocus()
  const { data: livePortfolio } = useTerminalPortfolio()
  const { walletAddress, isConnected, connect, shortAddr } = useSolana()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])

  const bookUsd =
    dataMode === 'demo' && snap.portions.status === 'ready'
      ? snap.portions.data.totalUsd
      : livePortfolio?.totalValueUsd ?? portfolioTotalUsd
  const pnlPct =
    dataMode === 'demo' && snap.portions.status === 'ready'
      ? snap.portions.data.pnl24hPct
      : livePortfolio?.summary?.totalPnlPct ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header
      className="tit-area-top flex items-center gap-3 border-b border-[var(--tit-border)] bg-[var(--tit-bg-1)] px-3"
      style={{ height: 'var(--tit-topbar)' }}
    >
      <Link href="/terminal" className="flex min-w-0 shrink-0 items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--tit-accent)]/15 text-[0.7rem] font-bold text-[var(--tit-accent)]"
          aria-hidden
        >
          CC
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.85rem] font-bold tracking-tight text-[var(--tit-text-0)]">
            CRYPTOCHECK AI
          </p>
          <p className="tit-label !text-[9px] !tracking-[0.12em]">Intelligence Terminal</p>
        </div>
      </Link>

      <form
        className="relative mx-auto flex min-w-0 max-w-lg flex-1 items-center"
        onSubmit={(e) => {
          e.preventDefault()
          const q = query.trim()
          if (q.length >= 32) selectMint(q)
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--tit-text-2)]" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search token / CA / Wallet"
          className="tit-input tit-mono h-8 w-full pl-8 pr-12"
          aria-label="Global search"
        />
        <kbd className="tit-mono absolute right-2 rounded border border-[var(--tit-border)] px-1.5 py-0.5 text-[0.55rem] text-[var(--tit-text-2)]">
          ⌘K
        </kbd>
      </form>

      <div className="flex shrink-0 items-center gap-2.5">
        {bookUsd > 0 ? (
          <div className="hidden text-right sm:block">
            <p className="tit-mono text-[0.85rem] font-bold text-[var(--tit-text-0)]">
              ${bookUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            {pnlPct != null ? (
              <p
                className={`tit-mono text-[0.55rem] ${
                  pnlPct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                }`}
              >
                {pnlPct >= 0 ? '+' : ''}
                {pnlPct.toFixed(2)}%
              </p>
            ) : null}
          </div>
        ) : null}

        {dataMode === 'demo' ? (
          <span className="tit-mono rounded border border-[var(--tit-warn)]/50 bg-[var(--tit-warn)]/15 px-2 py-1 text-[0.5rem] font-bold uppercase tracking-wide text-[var(--tit-warn)]">
            DEMO DATA
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setDataMode(dataMode === 'demo' ? 'live' : 'demo')}
          className="tit-mono rounded border border-[var(--tit-border)] px-2 py-1 text-[0.5rem] uppercase text-[var(--tit-text-1)] hover:border-[var(--tit-accent)]"
        >
          {dataMode === 'demo' ? 'Demo' : 'Live'}
        </button>

        <button
          type="button"
          className="relative rounded border border-[var(--tit-border)] p-1.5 text-[var(--tit-text-1)]"
          aria-label="Alerts"
        >
          <Bell className="h-3.5 w-3.5" />
          {dataMode === 'demo' ? (
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--tit-hot)] px-0.5 text-[0.45rem] font-bold text-white">
              12
            </span>
          ) : null}
        </button>

        {isConnected && walletAddress ? (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded border border-[var(--tit-border)] bg-[var(--tit-bg-2)] px-2 py-1"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--tit-accent)]/20 text-[0.5rem] font-bold text-[var(--tit-accent)]">
              {(shortAddr || walletAddress).slice(0, 2)}
            </span>
            <span className="tit-mono text-[0.6rem] text-[var(--tit-text-1)]">
              {shortAddr || `${walletAddress.slice(0, 4)}…`}
            </span>
            <ChevronDown className="h-3 w-3 text-[var(--tit-text-2)]" />
          </button>
        ) : (
          <button type="button" onClick={() => void connect()} className="tit-btn-accent h-8 px-3">
            Connect
          </button>
        )}

        <button
          type="button"
          onClick={() => onHelp?.()}
          className="tit-mono h-8 w-8 rounded border border-[var(--tit-border)] text-[0.7rem] text-[var(--tit-text-1)]"
          aria-label="Keyboard help"
        >
          ?
        </button>

        {focusSymbol ? (
          <span className="tit-mono hidden text-[0.6rem] text-[var(--tit-accent-bright)] 2xl:inline">
            {focusSymbol}
          </span>
        ) : null}
      </div>
    </header>
  )
}
