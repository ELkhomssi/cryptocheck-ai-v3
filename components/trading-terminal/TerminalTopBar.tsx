'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Bell, Search } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { CHART_MODES, type ChartMode } from '@/lib/trading-terminal/constants'
import { useTerminalFocus } from './TerminalFocusProvider'

const NAV: { href: string; label: string; active?: boolean }[] = [
  { href: '/terminal', label: 'TERMINAL', active: true },
  { href: '/dashboard', label: 'DASHBOARD' },
  { href: '/dashboard/signals', label: 'SCANS' },
  { href: '/dashboard/signals', label: 'ALERTS' },
  { href: '/dashboard/signals', label: 'INTEL' },
  { href: '/terminal', label: 'COACH' },
  { href: '/docs', label: 'API' },
  { href: '/dashboard/settings', label: 'SETTINGS' },
]

export function TerminalTopBar({ onHelp }: { onHelp?: () => void }) {
  const { chartMode, setChartMode, selectMint, focusSymbol } = useTerminalFocus()
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
      className="flex shrink-0 flex-col border-b border-[var(--tit-border)] bg-[var(--tit-bg-1)]"
      style={{ minHeight: 'var(--tit-topbar)' }}
    >
      <div className="flex h-11 items-center gap-3 px-3">
        <div className="min-w-0 shrink-0">
          <p className="text-[0.8rem] font-bold tracking-tight text-[var(--tit-text-0)]">
            CryptoCheck <span className="text-[var(--tit-accent-bright)]">AI</span>
          </p>
          <p className="tit-label !tracking-[0.16em]">Trading Intelligence Terminal</p>
        </div>

        <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Terminal nav">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`tit-mono rounded px-2 py-1 text-[0.6rem] font-semibold tracking-wide ${
                item.active
                  ? 'bg-[var(--tit-accent)]/20 text-[var(--tit-accent-bright)]'
                  : 'text-[var(--tit-text-2)] hover:text-[var(--tit-text-1)]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form
          className="relative mx-auto flex min-w-0 max-w-xl flex-1 items-center"
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

        <div className="flex items-center gap-1" role="group" aria-label="Chart layout">
          {CHART_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setChartMode(m as ChartMode)}
              className={`tit-mono h-7 w-7 rounded text-[0.65rem] font-bold ${
                chartMode === m
                  ? 'bg-[var(--tit-accent)] text-white'
                  : 'bg-[var(--tit-bg-3)] text-[var(--tit-text-1)]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="relative rounded border border-[var(--tit-border)] p-1.5 text-[var(--tit-text-1)]"
          aria-label="Alerts"
          title="Alerts"
        >
          <Bell className="h-3.5 w-3.5" />
        </button>

        {isConnected && walletAddress ? (
          <span className="tit-mono hidden rounded border border-[var(--tit-border)] px-2 py-1 text-[0.6rem] text-[var(--tit-text-1)] sm:inline">
            {shortAddr || `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`}
          </span>
        ) : (
          <button type="button" onClick={() => void connect()} className="tit-btn-accent h-7 px-3">
            Connect
          </button>
        )}

        <button
          type="button"
          onClick={() => onHelp?.()}
          className="tit-mono h-7 w-7 rounded border border-[var(--tit-border)] text-[0.7rem] text-[var(--tit-text-1)]"
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
