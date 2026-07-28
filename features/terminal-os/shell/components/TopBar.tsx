'use client'

import { useEffect } from 'react'
import { Bell, LayoutTemplate, Search, Star } from 'lucide-react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useTickerQuotes } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
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

  const { data: quotes, isError } = useTickerQuotes()

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
      <div style={{ position: 'relative', flex: '0 1 17.5rem', minWidth: '10rem' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: '0.625rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--tos-text-muted)',
          }}
        />
        <input
          id="tos-global-search"
          className="tos-input"
          style={{ paddingLeft: '2rem', paddingRight: '3rem' }}
          placeholder="Search token, wallet, pair…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchOpen(true)}
          aria-label="Global search"
        />
        <kbd
          style={{
            position: 'absolute',
            right: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 'var(--tos-fs-xs)',
            color: 'var(--tos-text-muted)',
            border: '1px solid var(--tos-border-subtle)',
            borderRadius: '0.25rem',
            padding: '0.125rem 0.3rem',
            fontFamily: 'var(--tos-mono)',
          }}
        >
          ⌘K
        </kbd>
      </div>

      <div
        className="tos-scroll-x"
        style={{ flex: 1, minWidth: 0, alignItems: 'center', gridAutoColumns: 'max-content' }}
        aria-label="Live ticker"
      >
        {isError ? (
          <span className="tos-neg" style={{ fontSize: 'var(--tos-fs-sm)' }}>
            Ticker offline
          </span>
        ) : !quotes ? (
          <div style={{ width: '15rem' }}>
            <PanelSkeleton rows={1} />
          </div>
        ) : (
          quotes.map((q) => (
            <div
              key={q.symbol}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.35rem',
                whiteSpace: 'nowrap',
                fontSize: 'var(--tos-fs-sm)',
                paddingRight: '0.75rem',
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
        <button
          type="button"
          className="tos-btn tos-btn-ghost"
          aria-label="Notifications"
          style={{ position: 'relative', padding: '0.5rem' }}
        >
          <Bell size={16} />
          {notificationCount > 0 ? (
            <span
              style={{
                position: 'absolute',
                top: '0.125rem',
                right: '0.125rem',
                minWidth: '0.875rem',
                height: '0.875rem',
                borderRadius: '999px',
                background: 'var(--tos-accent-gold)',
                color: 'var(--tos-bg-app)',
                fontSize: '0.5625rem',
                fontWeight: 800,
                display: 'grid',
                placeItems: 'center',
                padding: '0 0.2rem',
              }}
            >
              {notificationCount}
            </span>
          ) : null}
        </button>
        <button type="button" className="tos-btn tos-btn-ghost" aria-label="Favorites" style={{ padding: '0.5rem' }}>
          <Star size={16} />
        </button>
        <button type="button" className="tos-btn tos-btn-ghost" aria-label="Layout" style={{ padding: '0.5rem' }}>
          <LayoutTemplate size={16} />
        </button>
        <button
          type="button"
          className="tos-btn tos-btn-gold"
          onClick={() =>
            setWalletConnected(!walletConnected, walletConnected ? null : '7a8x…9f2b')
          }
        >
          {walletConnected ? walletLabel ?? 'Connected' : 'Connect Wallet'}
        </button>
      </div>
    </header>
  )
}
