'use client'

import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { TIT_DND_MIME } from '@/lib/trading-terminal/constants'
import { encodeTitDrag } from '@/lib/trading-terminal/dnd'
import { useTerminalFocus } from './TerminalFocusProvider'
import { MiniPortfolioCard } from './MiniPortfolioCard'
import { WatchlistSideList } from './WatchlistSideList'

function truncMint(m: string) {
  if (m.length < 10) return m
  return `${m.slice(0, 4)}…${m.slice(-4)}`
}

function badgeFor(row: UnifiedSignal): { label: string; className: string } | null {
  if (row.sample) return { label: 'SAMPLE', className: 'tit-badge tit-badge-risk' }
  if (row.verdict === 'danger') return { label: 'RISK', className: 'tit-badge tit-badge-risk' }
  if (row.verdict === 'safe') return { label: 'SAFE', className: 'tit-badge tit-badge-safe' }
  if (row.verdict === 'scanning') return { label: 'NEW', className: 'tit-badge tit-badge-new' }
  if (row.type === 'launch' || row.type === 'new_pool') {
    return { label: 'NEW', className: 'tit-badge tit-badge-new' }
  }
  if (typeof row.scoreValue === 'number' && row.scoreValue >= 70) {
    return { label: 'HOT', className: 'tit-badge tit-badge-hot' }
  }
  if (row.verdict === 'caution') {
    return { label: 'TRENDING', className: 'tit-badge tit-badge-trend' }
  }
  return null
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
  const {
    focusMint,
    discoverHighlight,
    selectSignal,
    setDiscoverHighlight,
  } = useTerminalFocus()

  return (
    <aside
      className="flex h-full shrink-0 flex-col border-r border-[var(--tit-border)] bg-[var(--tit-bg-1)]"
      style={{ width: 'var(--tit-left-panel)' }}
      aria-label="Discover"
    >
      <div className="flex items-center justify-between border-b border-[var(--tit-border)] px-2.5 py-2">
        <div>
          <p className="text-[0.7rem] font-bold text-[var(--tit-text-0)]">Discover</p>
          <p className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">{connectionLabel}</p>
        </div>
        <div className="flex gap-0.5">
          {(['1H', '6H', '24H'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onWindow(w)}
              className={`tit-mono rounded px-1.5 py-0.5 text-[0.55rem] font-bold ${
                win === w
                  ? 'bg-[var(--tit-accent)] text-white'
                  : 'bg-[var(--tit-bg-3)] text-[var(--tit-text-2)]'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-1.5 p-2" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-[var(--tit-bg-3)]" />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="space-y-2 p-2" role="alert">
          <p className="text-[0.7rem] text-[var(--tit-neg)]">{error}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="tit-btn-accent px-2 py-1 text-[0.6rem]">
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="p-2.5 text-[0.7rem] text-[var(--tit-text-1)]">
          Scanning for movers… Live when connection is live — no fabricated rows.
        </p>
      ) : null}

      <ul className="tit-scroll min-h-0 flex-1 overflow-y-auto">
        {rows.map((row, i) => {
          const mint = row.contractAddress?.trim() ?? ''
          const active = mint && mint === focusMint
          const highlighted = i === discoverHighlight
          const badge = badgeFor(row)
          const sym = row.tokenSymbol || row.label || truncMint(mint)
          return (
            <li key={row.id}>
              <button
                type="button"
                draggable={Boolean(mint) && !row.dropped}
                onDragStart={(e) => {
                  if (!mint) return
                  e.dataTransfer.setData(
                    TIT_DND_MIME,
                    encodeTitDrag({ mint, symbol: sym }),
                  )
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => {
                  setDiscoverHighlight(i)
                  if (mint) selectSignal(row)
                }}
                disabled={!mint || row.dropped}
                className={`flex w-full items-center gap-2 px-2.5 text-left transition-colors duration-[var(--tit-motion)] hover:bg-[var(--tit-bg-3)] disabled:opacity-40 ${
                  active ? 'tit-row-active' : highlighted ? 'bg-[var(--tit-bg-2)]' : ''
                }`}
                style={{ height: 'var(--tit-row-h)' }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[var(--tit-bg-3)] tit-mono text-[0.55rem] font-bold text-[var(--tit-text-1)]">
                  {sym.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-[0.7rem] font-semibold text-[var(--tit-text-0)]">
                      {sym}
                    </span>
                    {badge ? <span className={badge.className}>{badge.label}</span> : null}
                  </span>
                  <span className="tit-mono block truncate text-[0.5rem] text-[var(--tit-text-2)]">
                    {truncMint(mint)}
                  </span>
                </span>
                {typeof row.value === 'number' ? (
                  <span className="tit-mono shrink-0 text-[0.6rem] text-[var(--tit-text-1)]">
                    {row.value.toFixed(row.value < 1 ? 4 : 2)}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>

      <WatchlistSideList />
      <MiniPortfolioCard />
    </aside>
  )
}
