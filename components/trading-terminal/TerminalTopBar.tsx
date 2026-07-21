'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, Search } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { useTerminalFocus } from './TerminalFocusProvider'

const NAV: { href: string; label: string; active?: boolean }[] = [
  { href: '/terminal', label: 'TERMINAL', active: true },
  { href: '/dashboard', label: 'IDASHBOARD' },
  { href: '/dashboard/signals', label: 'SCANS' },
  { href: '/dashboard/signals', label: 'ALERTS' },
  { href: '/dashboard/signals', label: 'INTEL' },
  { href: '/terminal', label: 'COACH' },
  { href: '/docs', label: 'API' },
  { href: '/dashboard/settings', label: 'SETTINGS' },
]

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
      className="tit-area-top flex items-center gap-3 border-b border-[var(--tit-border)] bg-[var(--tit-bg-1)] px-3"
      style={{ height: 'var(--tit-topbar)' }}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--tit-accent)]/15 text-[0.7rem] font-bold text-[var(--tit-accent)]"
          aria-hidden
        >
          CC
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.85rem] font-bold tracking-tight text-[var(--tit-text-0)]">
            CryptoCheck AI
          </p>
          <p className="tit-label !text-[10px] !tracking-[0.1em]">Trading Intelligence Terminal</p>
        </div>
      </div>

      <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Terminal nav">
        {NAV.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`tit-mono relative rounded px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${
              item.active
                ? 'text-[var(--tit-text-0)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-[var(--tit-accent)]'
                : 'text-[var(--tit-text-1)] hover:text-[var(--tit-text-0)]'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <form
        className="relative mx-auto flex min-w-0 max-w-md flex-1 items-center"
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

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="relative rounded border border-[var(--tit-border)] p-1.5 text-[var(--tit-text-1)]"
          aria-label="Alerts"
          title="Alerts"
        >
          <Bell className="h-3.5 w-3.5" />
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
              {shortAddr || `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`}
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
