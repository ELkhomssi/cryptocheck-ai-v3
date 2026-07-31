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
      <div className="tos-search-wrap">
        <Search size={14} className="tos-search-icon" aria-hidden />
        <input
          id="tos-global-search"
          className="tos-input"
          style={{ paddingLeft: 'var(--tos-space-6)', paddingRight: 'var(--tos-space-8)' }}
          placeholder="Search token, wallet, pair…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchOpen(true)}
          aria-label="Global search"
        />
        <kbd className="tos-search-kbd">⌘K</kbd>
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

      <div className="tos-topbar-actions" style={{ position: 'relative' }}>
        {walletConnected && walletBalances ? (
          <span className="tos-muted tos-num" style={{ fontSize: 'var(--tos-fs-xs)' }}>
            {walletBalances.nativeAmount.toFixed(4)} {walletBalances.nativeSymbol}
            {walletBalances.totalValueUsd != null
              ? ` · $${walletBalances.totalValueUsd.toFixed(0)}`
              : ''}
            {walletBalances.tokens.length
              ? ` · ${walletBalances.tokens.length} tokens`
              : ''}
            {walletChainFamily ? ` · ${walletChainFamily}` : ''}
          </span>
        ) : null}
        <button
          type="button"
          className="tos-btn tos-btn-ghost tos-icon-btn"
          aria-label="Alerts"
          onClick={() => setActiveNav('alerts')}
        >
          <Bell size={16} />
          {notificationCount > 0 ? (
            <span className="tos-notif-dot">{notificationCount}</span>
          ) : null}
        </button>
        <button type="button" className="tos-btn tos-btn-ghost tos-icon-btn" aria-label="Favorites">
          <Star size={16} />
        </button>
        <button type="button" className="tos-btn tos-btn-ghost tos-icon-btn" aria-label="Layout">
          <LayoutTemplate size={16} />
        </button>
        {walletConnected ? (
          <button
            type="button"
            className="tos-btn tos-btn-gold tos-wallet-btn"
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
              className="tos-btn tos-btn-gold tos-wallet-btn"
              disabled={isConnecting}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {isConnecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="tos-wallet-menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 4,
                  zIndex: 50,
                  background: 'var(--tos-bg-panel-elevated)',
                  border: '1px solid var(--tos-border-subtle)',
                  borderRadius: 'var(--tos-radius-md, 8px)',
                  padding: 'var(--tos-space-2, 8px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--tos-space-2)',
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
