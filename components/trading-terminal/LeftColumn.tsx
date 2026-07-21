'use client'

import { useEffect, useMemo, useState } from 'react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { TIT_DND_MIME } from '@/lib/trading-terminal/constants'
import { encodeTitDrag } from '@/lib/trading-terminal/dnd'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import type { DiscoverToken } from '@/lib/trading-terminal/data/types'
import { applyDexQuotes, fetchDexQuotes } from '@/lib/trading-terminal/discover-enrich'
import { useTerminalFocus } from './TerminalFocusProvider'
import { MiniPortfolioCard } from './MiniPortfolioCard'
import { WatchlistSideList } from './WatchlistSideList'

function truncMint(m: string) {
  if (m.length < 10) return m
  return `${m.slice(0, 4)}…${m.slice(-4)}`
}

function badgeClass(b: DiscoverToken['badge']): string {
  if (b === 'HOT') return 'tit-badge tit-badge-hot'
  if (b === 'TRENDING') return 'tit-badge tit-badge-trend'
  if (b === 'NEW') return 'tit-badge tit-badge-new'
  if (b === 'RISK') return 'tit-badge tit-badge-risk'
  if (b === 'SAFE') return 'tit-badge tit-badge-safe'
  return 'tit-badge'
}

function signalToDiscover(row: UnifiedSignal): DiscoverToken | null {
  const mint = row.contractAddress?.trim()
  if (!mint) return null
  const badge =
    row.sample
      ? null
      : row.verdict === 'danger'
        ? 'RISK'
        : row.verdict === 'safe'
          ? 'SAFE'
          : row.verdict === 'scanning'
            ? 'NEW'
            : typeof row.scoreValue === 'number' && row.scoreValue >= 70
              ? 'HOT'
              : row.verdict === 'caution'
                ? 'TRENDING'
                : null
  return {
    mint,
    symbol: row.tokenSymbol || row.label || truncMint(mint),
    name: row.label || row.tokenSymbol || truncMint(mint),
    priceUsd: typeof row.value === 'number' ? row.value : 0,
    changePct: 0,
    marketCapUsd: 0,
    views: row.sourceCount ?? 0,
    badge,
  }
}

type Props = {
  rows: UnifiedSignal[]
  loading: boolean
  error: string | null
  connectionLabel: string
  onRetry?: () => void
  window: '1H' | '6H' | '24H'
  onWindow: (w: '1H' | '6H' | '24H') => void
}

export function LeftColumn({
  rows,
  loading,
  error,
  connectionLabel,
  onRetry,
  window: win,
  onWindow,
}: Props) {
  const { focusMint, discoverHighlight, selectMint, selectSignal, setDiscoverHighlight, dataMode } =
    useTerminalFocus()

  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])

  const baseTokens: DiscoverToken[] = useMemo(() => {
    if (dataMode === 'demo' && snap.discover.status === 'ready') return snap.discover.data
    return rows.map(signalToDiscover).filter((t): t is DiscoverToken => Boolean(t))
  }, [dataMode, snap.discover, rows])

  const [enriched, setEnriched] = useState<DiscoverToken[] | null>(null)

  useEffect(() => {
    if (dataMode !== 'live' || baseTokens.length === 0) {
      setEnriched(null)
      return
    }
    let cancelled = false
    const mints = baseTokens.slice(0, 24).map((t) => t.mint)
    void fetchDexQuotes(mints).then((quotes) => {
      if (cancelled) return
      setEnriched(applyDexQuotes(baseTokens, quotes))
    })
    return () => {
      cancelled = true
    }
  }, [dataMode, baseTokens])

  const tokens = dataMode === 'live' && enriched ? enriched : baseTokens

  const watchlists =
    dataMode === 'demo' && snap.watchlists.status === 'ready' ? snap.watchlists.data : null

  return (
    <aside
      className="flex h-full shrink-0 flex-col border-r border-[var(--tit-border)] bg-[var(--tit-bg-1)]"
      style={{ width: 'var(--tit-left-panel)' }}
      aria-label="Discover"
    >
      <div className="flex items-center justify-between border-b border-[var(--tit-border)] px-2.5 py-2">
        <div>
          <p className="tit-label !text-[11px] text-[var(--tit-text-0)]">Discover</p>
          <p className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">
            {dataMode === 'demo' ? 'demo seed' : connectionLabel}
          </p>
        </div>
        <div className="flex gap-0.5">
          {(['1H', '6H', '24H'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onWindow(w)}
              className={`tit-mono rounded px-1.5 py-0.5 text-[0.55rem] font-bold ${
                win === w
                  ? 'bg-[var(--tit-accent)] text-[#041016]'
                  : 'bg-[var(--tit-bg-3)] text-[var(--tit-text-2)]'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {loading && dataMode === 'live' ? (
        <div className="space-y-1.5 p-2" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="tit-skeleton h-8 w-full" />
          ))}
        </div>
      ) : null}

      {error && dataMode === 'live' ? (
        <div className="space-y-2 p-2" role="alert">
          <p className="text-[0.7rem] text-[var(--tit-neg)]">{error}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="tit-btn-accent px-2 py-1 text-[0.6rem]">
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && tokens.length === 0 ? (
        <p className="p-2.5 text-[0.7rem] text-[var(--tit-text-1)]">Awaiting market feed.</p>
      ) : null}

      <ul className="tit-scroll min-h-0 flex-1 overflow-y-auto">
        {tokens.map((tok, i) => {
          const active = tok.mint === focusMint
          const highlighted = i === discoverHighlight
          return (
            <li key={tok.mint}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    TIT_DND_MIME,
                    encodeTitDrag({ mint: tok.mint, symbol: tok.symbol }),
                  )
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => {
                  setDiscoverHighlight(i)
                  const live = rows.find((r) => r.contractAddress === tok.mint)
                  if (live) selectSignal(live)
                  else selectMint(tok.mint, tok.symbol)
                }}
                className={`flex w-full items-center gap-2 px-2.5 text-left transition-colors duration-[var(--tit-motion)] hover:bg-[var(--tit-bg-3)] ${
                  active ? 'tit-row-active' : highlighted ? 'bg-[var(--tit-bg-2)]' : ''
                }`}
                style={{ minHeight: 'var(--tit-row-h)' }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--tit-bg-3)] tit-mono text-[0.55rem] font-bold text-[var(--tit-text-1)]">
                  {tok.symbol.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="tit-mono truncate text-[0.7rem] font-semibold text-[var(--tit-text-0)]">
                      {tok.symbol}
                    </span>
                    {tok.badge ? <span className={badgeClass(tok.badge)}>{tok.badge}</span> : null}
                  </span>
                  <span className="block truncate text-[0.5rem] text-[var(--tit-text-2)]">
                    {tok.name}
                    {tok.views > 0 ? ` · ${tok.views.toLocaleString()} views` : ''}
                    {tok.marketCapUsd > 0
                      ? ` · mcap $${(tok.marketCapUsd / 1e6).toFixed(1)}M`
                      : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {tok.priceUsd > 0 ? (
                    <span className="tit-mono block text-[0.65rem] text-[var(--tit-text-0)]">
                      ${tok.priceUsd < 0.01 ? tok.priceUsd.toPrecision(3) : tok.priceUsd.toFixed(3)}
                    </span>
                  ) : null}
                  {tok.changePct !== 0 ? (
                    <span
                      className={`tit-mono text-[0.55rem] ${
                        tok.changePct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                      }`}
                    >
                      {tok.changePct >= 0 ? '▲' : '▼'}
                      {tok.changePct >= 0 ? '+' : ''}
                      {tok.changePct.toFixed(1)}%
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {watchlists ? (
        <div className="border-t border-[var(--tit-border)] px-2 py-1.5">
          <p className="tit-label mb-1">Watchlists</p>
          <ul className="space-y-0.5">
            {watchlists.map((w) => (
              <li key={w.id} className="flex justify-between text-[0.65rem]">
                <span className="text-[var(--tit-text-1)]">{w.name}</span>
                <span className="tit-mono text-[var(--tit-text-0)]">{w.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <WatchlistSideList />
      )}
      <MiniPortfolioCard />
    </aside>
  )
}
