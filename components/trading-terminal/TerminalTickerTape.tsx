'use client'

import { useEffect, useMemo, useState } from 'react'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import type { DiscoverToken } from '@/lib/trading-terminal/data/types'
import { applyDexQuotes, fetchDexQuotes } from '@/lib/trading-terminal/discover-enrich'
import { useTerminalFocus } from './TerminalFocusProvider'
import { useTerminalPortfolio } from './MiniPortfolioCard'

function formatPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 0.01) return n.toPrecision(3)
  if (n < 1) return n.toFixed(4)
  if (n < 1000) return n.toFixed(2)
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/**
 * Top ticker tape — live Dex quotes for SOL, focused mint, and wallet holdings.
 * Empty when no live prices (never fabricates).
 */
export function TerminalTickerTape() {
  const { dataMode, selectMint, focusMint, focusSymbol } = useTerminalFocus()
  const { data } = useTerminalPortfolio()
  const [liveTicker, setLiveTicker] = useState<DiscoverToken[]>([])
  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])

  const demoMovers =
    dataMode === 'demo' && snap.discover.status === 'ready'
      ? snap.discover.data.slice(0, 10)
      : []

  useEffect(() => {
    if (dataMode !== 'live') {
      setLiveTicker([])
      return
    }
    let cancelled = false
    const SOL = 'So11111111111111111111111111111111111111112'
    const byMint = new Map<string, DiscoverToken>()
    byMint.set(SOL, {
      mint: SOL,
      symbol: 'SOL',
      name: 'Solana',
      priceUsd: 0,
      changePct: 0,
      marketCapUsd: 0,
      views: 0,
      badge: null,
    })
    if (focusMint && focusMint.length >= 32 && !focusMint.startsWith('Demo')) {
      byMint.set(focusMint, {
        mint: focusMint,
        symbol: focusSymbol || focusMint.slice(0, 4),
        name: focusSymbol || focusMint.slice(0, 4),
        priceUsd: 0,
        changePct: 0,
        marketCapUsd: 0,
        views: 0,
        badge: null,
      })
    }
    const positions = data?.summary?.positions ?? []
    for (const h of positions.slice(0, 8)) {
      if (!h.mint || h.mint.length < 32) continue
      if (!byMint.has(h.mint)) {
        byMint.set(h.mint, {
          mint: h.mint,
          symbol: h.symbol || h.mint.slice(0, 4),
          name: h.name || h.symbol || 'Token',
          priceUsd: 0,
          changePct: 0,
          marketCapUsd: 0,
          views: 0,
          badge: null,
        })
      }
    }
    const seeds = [...byMint.values()]
    void fetchDexQuotes(seeds.map((s) => s.mint)).then((q) => {
      if (cancelled) return
      setLiveTicker(applyDexQuotes(seeds, q).filter((t) => t.priceUsd > 0 || t.changePct !== 0))
    })
    return () => {
      cancelled = true
    }
  }, [dataMode, focusMint, focusSymbol, data?.summary?.positions])

  const movers = dataMode === 'demo' ? demoMovers : liveTicker

  if (!movers.length) {
    return (
      <div className="tit-area-ticker tit-ticker" aria-label="Market ticker">
        <span className="tit-ticker-empty">
          {dataMode === 'live' ? 'Awaiting live quotes…' : 'Demo tape offline'}
        </span>
      </div>
    )
  }

  const renderTick = (m: DiscoverToken, key: string) => {
    const up = m.changePct >= 0
    return (
      <button
        key={key}
        type="button"
        className="tit-tick"
        onClick={() => selectMint(m.mint, m.symbol)}
      >
        <span className="sym">{m.symbol}</span>
        <span className="pr">${formatPrice(m.priceUsd)}</span>
        <span className={`chg ${up ? 'up' : 'down'}`}>
          {up ? '▲' : '▼'} {Math.abs(m.changePct).toFixed(2)}%
        </span>
      </button>
    )
  }

  return (
    <div className="tit-area-ticker tit-ticker" aria-label="Market ticker">
      <div className="tit-ticker-track">
        {movers.map((m) => renderTick(m, m.mint))}
        {movers.map((m) => renderTick(m, `${m.mint}-dup`))}
      </div>
    </div>
  )
}
