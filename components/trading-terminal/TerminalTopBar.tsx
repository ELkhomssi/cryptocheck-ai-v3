'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, ChevronDown, Search, User } from 'lucide-react'
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
      className="tit-area-top tit-glass flex items-center gap-4 border-b border-[var(--tit-border)] px-4"
      style={{ height: 'var(--tit-topbar)' }}
    >
      {/* Left — brand */}
      <Link href="/terminal" className="group flex min-w-0 shrink-0 items-center gap-3">
        <span
          className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--tit-accent)]/12 text-[0.72rem] font-bold tracking-tight text-[var(--tit-accent-bright)] ring-1 ring-[var(--tit-accent)]/25 transition-shadow duration-[var(--tit-motion)] group-hover:shadow-[0_0_20px_rgba(0,212,255,0.25)]"
          aria-hidden
        >
          <span className="tit-display">CC</span>
          <span className="tit-pulse-accent absolute -bottom-0.5 -right-0.5 !h-2 !w-2" />
        </span>
        <div className="min-w-0">
          <p className="tit-display truncate text-[0.95rem] font-semibold tracking-tight text-[var(--tit-text-0)]">
            CryptoCheck AI
          </p>
          <p className="tit-label !text-[9px] !tracking-[0.14em] !text-[var(--tit-text-2)]">
            Institutional Intelligence
          </p>
        </div>
      </Link>

      {/* Center — global search */}
      <form
        className="relative mx-auto flex min-w-0 max-w-xl flex-1 items-center"
        onSubmit={(e) => {
          e.preventDefault()
          const q = query.trim()
          if (q.length >= 32) selectMint(q)
        }}
      >
        <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[var(--tit-text-2)]" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search token · contract · wallet"
          className="tit-input tit-mono h-9 w-full rounded-[10px] border-[var(--tit-border)] bg-[rgba(5,7,10,0.55)] pl-9 pr-14 text-[0.78rem]"
          aria-label="Global search"
        />
        <kbd className="tit-mono absolute right-2.5 rounded-md border border-[var(--tit-border)] bg-[var(--tit-bg-2)]/80 px-1.5 py-0.5 text-[0.58rem] text-[var(--tit-text-2)]">
          ⌘K
        </kbd>
      </form>

      {/* Right — portfolio · alerts · wallet · profile */}
      <div className="flex shrink-0 items-center gap-2.5">
        {bookUsd > 0 ? (
          <div className="hidden rounded-[10px] border border-[var(--tit-border)] bg-[rgba(17,25,39,0.55)] px-3 py-1.5 text-right sm:block">
            <p className="tit-label !mb-0.5 !text-[8px]">Portfolio</p>
            <p className="tit-mono text-[0.88rem] font-semibold leading-none text-[var(--tit-text-0)]">
              ${bookUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            {pnlPct != null ? (
              <p
                className={`tit-mono mt-0.5 text-[0.62rem] ${
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
          <span className="tit-mono rounded-md border border-[var(--tit-warn)]/40 bg-[var(--tit-warn)]/10 px-2 py-1 text-[0.55rem] font-bold uppercase tracking-wide text-[var(--tit-warn)]">
            Demo
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setDataMode(dataMode === 'demo' ? 'live' : 'demo')}
          className="tit-btn-ghost tit-mono h-8 px-2.5 text-[0.55rem] uppercase tracking-wide"
        >
          {dataMode === 'demo' ? 'Demo' : 'Live'}
        </button>

        <button
          type="button"
          className="tit-btn-ghost relative flex h-9 w-9 items-center justify-center p-0"
          aria-label="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          {dataMode === 'demo' ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--tit-hot)] px-0.5 text-[0.45rem] font-bold text-white shadow-[0_0_8px_rgba(255,138,61,0.5)]">
              12
            </span>
          ) : null}
        </button>

        {isConnected && walletAddress ? (
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-[10px] border border-[var(--tit-border)] bg-[rgba(17,25,39,0.65)] px-2.5 transition-colors duration-[var(--tit-motion)] hover:border-[var(--tit-border-strong)]"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tit-accent)]/15 text-[0.55rem] font-bold text-[var(--tit-accent-bright)] ring-1 ring-[var(--tit-accent)]/30">
              {(shortAddr || walletAddress).slice(0, 2)}
            </span>
            <span className="tit-mono text-[0.68rem] text-[var(--tit-text-1)]">
              {shortAddr || `${walletAddress.slice(0, 4)}…`}
            </span>
            <ChevronDown className="h-3 w-3 text-[var(--tit-text-2)]" />
          </button>
        ) : (
          <button type="button" onClick={() => void connect()} className="tit-btn-accent h-9 px-4">
            Connect
          </button>
        )}

        <button
          type="button"
          className="tit-btn-ghost flex h-9 w-9 items-center justify-center p-0"
          aria-label="Profile"
        >
          <User className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onHelp?.()}
          className="tit-btn-ghost tit-mono flex h-9 w-9 items-center justify-center p-0 text-[0.75rem]"
          aria-label="Keyboard help"
        >
          ?
        </button>

        {focusSymbol ? (
          <span className="tit-mono hidden rounded-md border border-[var(--tit-accent)]/25 bg-[var(--tit-accent)]/8 px-2 py-1 text-[0.62rem] text-[var(--tit-accent-bright)] 2xl:inline">
            {focusSymbol}
          </span>
        ) : null}
      </div>
    </header>
  )
}
