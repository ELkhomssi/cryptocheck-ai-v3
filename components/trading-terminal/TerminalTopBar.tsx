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
      className="tit-area-top flex items-center gap-6 border-b border-[var(--tit-border)] bg-[var(--tit-bg-1)] px-6"
      style={{ height: 'var(--tit-topbar)' }}
    >
      <Link href="/terminal" className="group flex min-w-0 shrink-0 items-center gap-3.5">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--tit-bg-2)] text-[0.7rem] font-semibold tracking-tight text-[var(--tit-text-0)] transition-colors duration-[var(--tit-motion)] group-hover:bg-[var(--tit-bg-3)]"
          aria-hidden
        >
          <span className="tit-display">CC</span>
        </span>
        <div className="min-w-0">
          <p className="tit-display truncate text-[1.05rem] font-semibold tracking-tight text-[var(--tit-text-0)]">
            CryptoCheck AI
          </p>
          <p className="tit-label !text-[10px] !tracking-[0.12em] !text-[var(--tit-text-2)]">
            Institutional Intelligence
          </p>
        </div>
      </Link>

      <form
        className="relative mx-auto flex min-w-0 max-w-xl flex-1 items-center"
        onSubmit={(e) => {
          e.preventDefault()
          const q = query.trim()
          if (q.length >= 32) selectMint(q)
        }}
      >
        <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--tit-text-2)]" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search token · contract · wallet"
          className="tit-input tit-mono h-10 w-full rounded-[8px] border-[var(--tit-border)] bg-[var(--tit-bg-0)] pl-10 pr-14 text-[0.8125rem]"
          aria-label="Global search"
        />
        <kbd className="tit-mono absolute right-3 rounded-[6px] border border-[var(--tit-border)] bg-[var(--tit-bg-2)] px-1.5 py-0.5 text-[0.625rem] text-[var(--tit-text-2)]">
          ⌘K
        </kbd>
      </form>

      <div className="flex shrink-0 items-center gap-3">
        {bookUsd > 0 ? (
          <div className="hidden px-1 text-right sm:block">
            <p className="tit-label !mb-1 !text-[10px]">Portfolio</p>
            <p className="tit-mono text-[0.9375rem] font-semibold leading-none text-[var(--tit-text-0)]">
              ${bookUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            {pnlPct != null ? (
              <p
                className={`tit-mono mt-1 text-[0.6875rem] ${
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
          <span className="tit-mono rounded-[6px] border border-[var(--tit-warn)]/30 bg-[var(--tit-warn)]/8 px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--tit-warn)]">
            Demo
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setDataMode(dataMode === 'demo' ? 'live' : 'demo')}
          className="tit-btn-ghost tit-mono h-9 px-3 text-[0.625rem] uppercase tracking-wide"
        >
          {dataMode === 'demo' ? 'Demo' : 'Live'}
        </button>

        <button
          type="button"
          className="tit-btn-ghost relative flex h-9 w-9 items-center justify-center p-0"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {dataMode === 'demo' ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--tit-hot)] px-0.5 text-[0.5rem] font-semibold text-white">
              12
            </span>
          ) : null}
        </button>

        {isConnected && walletAddress ? (
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-[8px] border border-[var(--tit-border)] bg-[var(--tit-bg-2)] px-2.5 transition-colors duration-[var(--tit-motion)] hover:border-[var(--tit-border-strong)]"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tit-bg-3)] text-[0.55rem] font-semibold text-[var(--tit-text-1)]">
              {(shortAddr || walletAddress).slice(0, 2)}
            </span>
            <span className="tit-mono text-[0.75rem] text-[var(--tit-text-1)]">
              {shortAddr || `${walletAddress.slice(0, 4)}…`}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--tit-text-2)]" />
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
          <User className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => onHelp?.()}
          className="tit-btn-ghost tit-mono flex h-9 w-9 items-center justify-center p-0 text-[0.8125rem]"
          aria-label="Keyboard help"
        >
          ?
        </button>

        {focusSymbol ? (
          <span className="tit-mono hidden rounded-[6px] bg-[var(--tit-bg-2)] px-2.5 py-1.5 text-[0.6875rem] text-[var(--tit-text-1)] 2xl:inline">
            {focusSymbol}
          </span>
        ) : null}
      </div>
    </header>
  )
}
