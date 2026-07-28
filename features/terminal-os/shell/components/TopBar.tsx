'use client'

import { useEffect, useState } from 'react'
import { Bell, LayoutTemplate, Search, Star } from 'lucide-react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { mockMarketDataProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import type { TickerQuote } from '@/features/terminal-os/shared/types'
import { formatPct, formatUsd } from '@/features/terminal-os/shared/lib/format'
import { PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'

export function TopBar() {
  const notificationCount = useTerminalOsStore((s) => s.notificationCount)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const walletLabel = useTerminalOsStore((s) => s.walletLabel)
  const setWalletConnected = useTerminalOsStore((s) => s.setWalletConnected)
  const setSearchOpen = useTerminalOsStore((s) => s.setSearchOpen)
  const searchQuery = useTerminalOsStore((s) => s.searchQuery)
  const setSearchQuery = useTerminalOsStore((s) => s.setSearchQuery)

  const [quotes, setQuotes] = useState<TickerQuote[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    mockMarketDataProvider
      .getTickerQuotes()
      .then((q) => {
        if (!cancelled) setQuotes(q)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        document.getElementById('tos-global-search')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen])

  return (
    <header className="tos-topbar">
      <div style={{ position: 'relative', flex: '0 1 280px', minWidth: 160 }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--tos-text-muted)',
          }}
        />
        <input
          id="tos-global-search"
          className="tos-input"
          style={{ paddingLeft: 32, paddingRight: 48 }}
          placeholder="Search token, wallet, pair…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchOpen(true)}
          aria-label="Global search"
        />
        <kbd
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 10,
            color: 'var(--tos-text-muted)',
            border: '1px solid var(--tos-border-subtle)',
            borderRadius: 4,
            padding: '2px 5px',
            fontFamily: 'var(--tos-mono)',
          }}
        >
          ⌘K
        </kbd>
      </div>

      <div
        className="tos-scroll-x"
        style={{ flex: 1, minWidth: 0, alignItems: 'center' }}
        aria-label="Live ticker"
      >
        {error ? (
          <span className="tos-neg" style={{ fontSize: 12 }}>
            Ticker offline
          </span>
        ) : !quotes ? (
          <div style={{ width: 240 }}>
            <PanelSkeleton rows={1} />
          </div>
        ) : (
          quotes.map((q) => (
            <div
              key={q.symbol}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                whiteSpace: 'nowrap',
                fontSize: 12,
                paddingRight: 12,
                borderRight: '1px solid var(--tos-border-subtle)',
              }}
            >
              <strong>{q.symbol}</strong>
              <span className="tos-num">{formatUsd(q.priceUsd)}</span>
              <span className={`tos-num ${q.change24hPct >= 0 ? 'tos-pos' : 'tos-neg'}`}>
                ({formatPct(q.change24hPct)})
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <button type="button" className="tos-btn tos-btn-ghost" aria-label="Notifications" style={{ position: 'relative', padding: 8 }}>
          <Bell size={16} />
          {notificationCount > 0 ? (
            <span
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                minWidth: 14,
                height: 14,
                borderRadius: 7,
                background: 'var(--tos-accent-gold)',
                color: 'var(--tos-bg-app)',
                fontSize: 9,
                fontWeight: 800,
                display: 'grid',
                placeItems: 'center',
                padding: '0 3px',
              }}
            >
              {notificationCount}
            </span>
          ) : null}
        </button>
        <button type="button" className="tos-btn tos-btn-ghost" aria-label="Favorites" style={{ padding: 8 }}>
          <Star size={16} />
        </button>
        <button type="button" className="tos-btn tos-btn-ghost" aria-label="Layout" style={{ padding: 8 }}>
          <LayoutTemplate size={16} />
        </button>
        <button
          type="button"
          className="tos-btn tos-btn-gold"
          onClick={() =>
            setWalletConnected(
              !walletConnected,
              walletConnected ? null : '7a8x…9f2b',
            )
          }
        >
          {walletConnected ? walletLabel ?? 'Connected' : 'Connect Wallet'}
        </button>
      </div>
    </header>
  )
}
