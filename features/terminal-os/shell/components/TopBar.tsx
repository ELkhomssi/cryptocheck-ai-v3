'use client'

import { useEffect, useState, startTransition } from 'react'
import { Bell, LayoutTemplate, Search, Star } from 'lucide-react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useTickerQuotes } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { useTerminalMarketStream } from '@/features/terminal-os/shared/hooks/useTerminalMarketStream'
import { formatPct, formatUsd } from '@/features/terminal-os/shared/lib/format'
import { PanelSkeleton, StaleIndicator } from '@/features/terminal-os/shared/components/PanelStates'
import { AnimatedNumber } from '@/features/terminal-os/shared/components/AnimatedNumber'
import { useTerminalWallet } from '@/features/terminal-os/wallet/useTerminalWallet'

export function TopBar() {
  const notificationCount = useTerminalOsStore((s) => s.notificationCount)
  const setActiveNav = useTerminalOsStore((s) => s.setActiveNav)
  const setSearchOpen = useTerminalOsStore((s) => s.setSearchOpen)
  const searchQuery = useTerminalOsStore((s) => s.searchQuery)
  const setSearchQuery = useTerminalOsStore((s) => s.setSearchQuery)
  const walletBalances = useTerminalOsStore((s) => s.walletBalances)
  const walletChainFamily = useTerminalOsStore((s) => s.walletChainFamily)

  const {
    walletConnected,
    walletLabel,
    isConnecting,
    connectSolana,
    connectEvm,
    disconnect,
    evmError,
  } = useTerminalWallet()

  const [menuOpen, setMenuOpen] = useState(false)

  const { data: quotes } = useTickerQuotes()
  const stream = useTerminalMarketStream()
  const [lkg, setLkg] = useState(quotes)
  useEffect(() => {
    if (quotes?.length) setLkg(quotes)
  }, [quotes])
  const shown = quotes?.length ? quotes : lkg

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
        {!shown ? (
          <div style={{ width: '15rem' }}>
            <PanelSkeleton rows={1} />
          </div>
        ) : (
          <>
            {shown.map((q) => (
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
                <AnimatedNumber
                  value={q.priceUsd}
                  format={(n) => formatUsd(n)}
                  className="tos-num"
                />
                <span className={`tos-num ${q.change24hPct >= 0 ? 'tos-pos' : 'tos-neg'}`}>
                  (<AnimatedNumber value={q.change24hPct} format={(n) => formatPct(n)} />)
                </span>
              </div>
            ))}
            <StaleIndicator
              stale={stream.ticker?.stale}
              demo={stream.ticker?.demo}
              ageSec={stream.ticker?.ageSec}
              source={stream.ticker?.source}
            />
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', position: 'relative' }}>
        {walletConnected && walletBalances ? (
          <span className="tos-muted tos-num" style={{ fontSize: 'var(--tos-fs-xs)' }}>
            {walletBalances.nativeAmount.toFixed(4)} {walletBalances.nativeSymbol}
            {walletChainFamily ? ` · ${walletChainFamily}` : ''}
          </span>
        ) : null}
        <button
          type="button"
          className="tos-btn tos-btn-ghost"
          aria-label="Alerts"
          style={{ position: 'relative', padding: '0.5rem' }}
          onClick={() => setActiveNav('alerts')}
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
        {walletConnected ? (
          <button
            type="button"
            className="tos-btn tos-btn-gold"
            disabled={isConnecting}
            onClick={() => {
              startTransition(() => {
                void disconnect()
              })
            }}
          >
            {walletLabel ?? 'Connected'} · Disconnect
          </button>
        ) : (
          <>
            <button
              type="button"
              className="tos-btn tos-btn-gold"
              disabled={isConnecting}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {isConnecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
            {menuOpen ? (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 4,
                  zIndex: 50,
                  background: 'var(--tos-bg-panel-elevated)',
                  border: '1px solid var(--tos-border-subtle)',
                  borderRadius: 8,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  minWidth: 180,
                }}
              >
                <button
                  type="button"
                  className="tos-btn tos-btn-ghost"
                  onClick={() => {
                    setMenuOpen(false)
                    void connectSolana()
                  }}
                >
                  Solana (Phantom / Solflare)
                </button>
                <button
                  type="button"
                  className="tos-btn tos-btn-ghost"
                  onClick={() => {
                    setMenuOpen(false)
                    void connectEvm()
                  }}
                >
                  EVM (injected)
                </button>
                {evmError ? (
                  <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', margin: 0 }}>
                    {evmError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </header>
  )
}
