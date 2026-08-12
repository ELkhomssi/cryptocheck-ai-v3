'use client'

import { useEffect, useState, startTransition } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, LayoutTemplate, Search, Star } from 'lucide-react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useTickerQuotes } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { useTerminalMarketStream } from '@/features/terminal-os/shared/hooks/useTerminalMarketStream'
import { useMarketOverview } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { formatPct, formatUsd } from '@/features/terminal-os/shared/lib/format'
import { PanelSkeleton, StaleIndicator } from '@/features/terminal-os/shared/components/PanelStates'
import { AnimatedNumber } from '@/features/terminal-os/shared/components/AnimatedNumber'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import { useTerminalWallet } from '@/features/terminal-os/wallet/useTerminalWallet'
import { useRailBadges } from '@/features/terminal-os/shell/hooks/useRailBadges'
import type { ChainId, TokenRow } from '@/features/terminal-os/shared/types'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import { summaryFromHoldings } from '@/features/terminal-os/portfolio-os/lib/summary-from-holdings'

function looksLikeMintOrAddress(q: string): boolean {
  const t = q.trim()
  if (t.startsWith('0x') && t.length >= 42) return true
  // Solana base58 mint / wallet
  return t.length >= 32 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(t)
}

async function resolveSearchFocus(raw: string): Promise<{
  id: string
  symbol: string
  name: string
  chain: ChainId
  priceUsd: number
  logoUrl?: string
}> {
  const q = raw.trim()
  if (!q) {
    return { id: 'SOL', symbol: 'SOL', name: 'SOL', chain: 'solana', priceUsd: 0 }
  }

  if (looksLikeMintOrAddress(q)) {
    return {
      id: q,
      symbol: q.slice(0, 6),
      name: q,
      chain: q.startsWith('0x') ? 'ethereum' : 'solana',
      priceUsd: 0,
    }
  }

  try {
    const res = await fetch('/api/terminal-os/feed?resource=tokens&chain=all&limit=48')
    if (res.ok) {
      const body = (await res.json()) as { items?: TokenRow[] }
      const lower = q.toLowerCase().replace(/^\$/, '')
      const hit = (body.items || []).find(
        (t) =>
          t.symbol.toLowerCase() === lower ||
          t.id.toLowerCase() === lower ||
          t.name.toLowerCase().includes(lower),
      )
      if (hit) {
        return {
          id: hit.id,
          symbol: hit.symbol,
          name: hit.name,
          chain: hit.chain === 'all' ? 'solana' : hit.chain,
          priceUsd: hit.priceUsd,
          logoUrl: hit.logoUrl,
        }
      }
    }
  } catch {
    /* fall through */
  }

  const symbol = q.replace(/^\$/, '').toUpperCase()
  return { id: symbol, symbol, name: symbol, chain: 'solana', priceUsd: 0 }
}

export function TopBar() {
  const notificationCount = useTerminalOsStore((s) => s.notificationCount)
  const setActiveNav = useTerminalOsStore((s) => s.setActiveNav)
  const setSearchOpen = useTerminalOsStore((s) => s.setSearchOpen)
  const searchQuery = useTerminalOsStore((s) => s.searchQuery)
  const setSearchQuery = useTerminalOsStore((s) => s.setSearchQuery)
  const setFocusedToken = useTerminalOsStore((s) => s.setFocusedToken)
  const setChartChainTab = useTerminalOsStore((s) => s.setChartChainTab)
  const walletAddress = useTerminalOsStore((s) => s.walletAddress)
  const walletChainFamily = useTerminalOsStore((s) => s.walletChainFamily)
  const [searchBusy, setSearchBusy] = useState(false)

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
  const { data: overview } = useMarketOverview()
  const stream = useTerminalMarketStream()
  const rail = useRailBadges()
  const [lkg, setLkg] = useState(quotes)
  useEffect(() => {
    if (quotes?.length) setLkg(quotes)
  }, [quotes])
  const shown = quotes?.length ? quotes : lkg

  const holdingsQ = useQuery({
    queryKey: ['tos', 'topbar-holdings', walletAddress, walletChainFamily],
    enabled: Boolean(walletConnected && walletAddress),
    queryFn: async () => {
      const qs = new URLSearchParams({ wallet: walletAddress! })
      if (walletChainFamily === 'evm') qs.set('chain', 'ethereum')
      const res = await fetch(`/api/portfolio/holdings?${qs}`, {
        cache: 'no-store',
      })
      if (!res.ok) return null
      return (await res.json()) as HoldingsResponse
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
  })

  const portfolioSummary = holdingsQ.data ? summaryFromHoldings(holdingsQ.data) : null

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
    <header className="tos-topbar" data-tos-topbar="v3">
      <div className="tos-topbar-brand">
        <strong>
          CryptoCheck AI <em className="tos-topbar-brand-accent">TERMINAL OS</em>
        </strong>
      </div>

      <div
        className="tos-topbar-sys"
        data-status={rail.health.status}
        title={rail.health.label}
      >
        <span className="tos-topbar-sys-dot" aria-hidden />
        <span className="tos-topbar-sys-text">{rail.health.label}</span>
      </div>

      <div className="tos-search-wrap">
        <Search size={14} className="tos-search-icon" aria-hidden />
        <input
          id="tos-global-search"
          className="tos-input"
          style={{ paddingLeft: 'var(--tos-space-6)', paddingRight: 'var(--tos-space-8)' }}
          placeholder="Search token, mint, pair… (Enter to focus)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            const q = searchQuery.trim()
            if (!q || searchBusy) return
            setSearchBusy(true)
            void resolveSearchFocus(q)
              .then((token) => {
                startTransition(() => {
                  setFocusedToken(token)
                  setChartChainTab(token.chain === 'all' ? 'solana' : token.chain)
                  setSearchOpen(false)
                  setActiveNav('terminal')
                })
              })
              .finally(() => setSearchBusy(false))
          }}
          aria-label="Global search"
          disabled={searchBusy}
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

      <div className="tos-topbar-mkt" aria-label="Global market stats">
        <div>
          <span>TOTAL MKT CAP</span>
          <strong className="tos-num">
            {overview ? formatUsd(overview.marketCapUsd, true) : '—'}
          </strong>
        </div>
        <div>
          <span>24H VOLUME</span>
          <strong className="tos-num">
            {overview ? formatUsd(overview.volume24hUsd, true) : '—'}
          </strong>
        </div>
      </div>

      <div className="tos-topbar-actions" style={{ position: 'relative' }}>
        <div className="tos-topbar-portfolio" data-loaded={portfolioSummary ? 'true' : 'false'}>
          <span className="tos-topbar-portfolio-label">Portfolio value</span>
          {walletConnected && walletChainFamily === 'evm' && !portfolioSummary ? (
            <span className="tos-muted">{holdingsQ.isLoading ? 'Loading EVM…' : 'Not enough data yet'}</span>
          ) : !walletConnected ? (
            <span className="tos-muted">Connect wallet</span>
          ) : portfolioSummary ? (
            <>
              <strong className="tos-num">
                {formatUsd(portfolioSummary.totalAssetsUsd, true)}
              </strong>
              <span className="tos-topbar-portfolio-pnl">
                <AnimatedNumber
                  value={portfolioSummary.pnl24hUsd}
                  format={(n) => formatUsd(n, true)}
                />{' '}
                <Pct value={portfolioSummary.pnl24hPct} />
              </span>
            </>
          ) : holdingsQ.isLoading ? (
            <span className="tos-muted">Loading…</span>
          ) : (
            <span className="tos-muted">Not enough data yet</span>
          )}
        </div>
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
              onClick={() => {
                // Primary path: open Solana wallet-adapter modal immediately (Phantom / Solflare / Backpack).
                setMenuOpen(false)
                void connectSolana()
              }}
            >
              {isConnecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
            <button
              type="button"
              className="tos-btn tos-btn-ghost"
              style={{ fontSize: 'var(--tos-fs-xs)' }}
              disabled={isConnecting}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More wallet options"
            >
              ▾
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
                  Solana (Phantom / Solflare / Backpack)
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
