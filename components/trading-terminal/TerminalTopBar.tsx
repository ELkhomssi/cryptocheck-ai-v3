'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, Search, User } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { useTerminalFocus } from './TerminalFocusProvider'

export function TerminalTopBar({ onHelp }: { onHelp?: () => void }) {
  const { selectMint, focusSymbol } = useTerminalFocus()
  const { walletAddress, isConnected, connect, shortAddr } = useSolana()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

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
      className="tit-area-top flex items-center gap-4 border-b border-[var(--tit-border)] bg-white px-6"
      style={{ height: 'var(--tit-topbar)' }}
    >
      <form
        className="relative mx-auto flex min-w-0 max-w-2xl flex-1 items-center"
        onSubmit={(e) => {
          e.preventDefault()
          const q = query.trim()
          if (q.length >= 32) selectMint(q)
        }}
      >
        <Search className="pointer-events-none absolute left-4 h-4 w-4 text-[var(--tit-text-2)]" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search token, contract, or wallet"
          className="h-11 w-full rounded-full border border-[var(--tit-border)] bg-[var(--tit-bg-1)] pl-11 pr-16 text-[0.875rem] font-medium text-[var(--tit-text-0)] outline-none transition-[border-color,box-shadow] duration-[var(--tit-motion)] placeholder:text-[var(--tit-text-2)] focus:border-[rgba(37,99,235,0.35)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
          aria-label="Global search"
        />
        <kbd className="absolute right-3 rounded-[8px] border border-[var(--tit-border)] bg-white px-2 py-1 text-[0.6875rem] font-medium text-[var(--tit-text-2)]">
          ⌘K
        </kbd>
      </form>

      <div className="flex shrink-0 items-center gap-2.5">
        <span className="hidden items-center gap-2 rounded-full border border-[var(--tit-border)] bg-[var(--tit-bg-1)] px-3 py-2 text-[0.75rem] font-semibold text-[var(--tit-text-1)] sm:inline-flex">
          <span className="h-2 w-2 rounded-full bg-[var(--tit-pos)]" aria-hidden />
          Solana
        </span>

        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--tit-border)] bg-white text-[var(--tit-text-1)] transition-colors hover:bg-[var(--tit-bg-1)]"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
        </button>

        {isConnected && walletAddress ? (
          <button
            type="button"
            className="flex h-10 items-center gap-2 rounded-full border border-[var(--tit-border)] bg-white px-3 transition-colors hover:bg-[var(--tit-bg-1)]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(37,99,235,0.1)] text-[0.625rem] font-semibold text-[var(--tit-accent)]">
              {(shortAddr || walletAddress).slice(0, 2)}
            </span>
            <span className="text-[0.8125rem] font-semibold text-[var(--tit-text-0)]">
              {shortAddr || `${walletAddress.slice(0, 4)}…`}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--tit-text-2)]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void connect()}
            className="h-10 rounded-full bg-[var(--tit-accent)] px-5 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[var(--tit-accent-bright)]"
          >
            Connect
          </button>
        )}

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--tit-border)] bg-white text-[var(--tit-text-1)] hover:bg-[var(--tit-bg-1)]"
          aria-label="Profile"
        >
          <User className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={() => onHelp?.()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--tit-border)] bg-white text-[0.8125rem] font-semibold text-[var(--tit-text-1)] hover:bg-[var(--tit-bg-1)]"
          aria-label="Keyboard help"
        >
          ?
        </button>

        {focusSymbol ? (
          <span className="hidden rounded-full bg-[var(--tit-bg-1)] px-3 py-2 text-[0.75rem] font-semibold text-[var(--tit-text-1)] 2xl:inline">
            {focusSymbol}
          </span>
        ) : null}
      </div>
    </header>
  )
}
