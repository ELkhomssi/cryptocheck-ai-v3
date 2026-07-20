'use client'

import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { TIT_DND_MIME } from '@/lib/trading-terminal/constants'
import { encodeTitDrag } from '@/lib/trading-terminal/dnd'
import { useTerminalFocus } from './TerminalFocusProvider'

function truncMint(m: string) {
  if (m.length < 10) return m
  return `${m.slice(0, 4)}…${m.slice(-4)}`
}

function verdictColor(v: UnifiedSignal['verdict']): string {
  if (v === 'safe') return 'var(--tit-safe)'
  if (v === 'caution') return 'var(--tit-caution)'
  if (v === 'danger') return 'var(--tit-danger)'
  return 'var(--tit-text-2)'
}

type Props = {
  rows: UnifiedSignal[]
  loading: boolean
  error: string | null
  connectionLabel: string
  onRetry?: () => void
}

export function DiscoverRail({ rows, loading, error, connectionLabel, onRetry }: Props) {
  const {
    focusMint,
    discoverHighlight,
    selectSignal,
    setDiscoverHighlight,
    discoverCollapsed,
    setDiscoverCollapsed,
  } = useTerminalFocus()

  if (discoverCollapsed) {
    return (
      <aside
        className="tit-panel flex w-10 flex-col items-center gap-2 py-3"
        aria-label="Discover collapsed"
      >
        <button
          type="button"
          className="tit-label"
          style={{ writingMode: 'vertical-rl' }}
          onClick={() => setDiscoverCollapsed(false)}
        >
          Discover
        </button>
      </aside>
    )
  }

  return (
    <aside className="tit-panel flex h-full w-full flex-col overflow-hidden" aria-label="Discover">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <p className="tit-label">Discover</p>
        <span className="tit-mono text-[0.6rem] text-[var(--tit-text-2)]">{connectionLabel}</span>
      </div>

      {loading ? (
        <div className="space-y-2 p-3" aria-busy>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded bg-[var(--tit-bg-3)]" />
          ))}
          <p className="text-[0.65rem] text-[var(--tit-text-2)]">Loading feed…</p>
        </div>
      ) : null}

      {error ? (
        <div className="space-y-2 p-3" role="alert">
          <p className="text-xs text-[var(--tit-neg)]">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="tit-btn-ember px-2 py-1 text-[0.65rem]"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="p-3 text-xs text-[var(--tit-text-1)]">
          No token signals in window. Feed is live when connection shows “live” — no fabricated rows.
        </p>
      ) : null}

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((row, i) => {
          const mint = row.contractAddress?.trim() ?? ''
          const active = mint && mint === focusMint
          const highlighted = i === discoverHighlight
          return (
            <li key={row.id}>
              <button
                type="button"
                draggable={Boolean(mint) && !row.dropped}
                onDragStart={(e) => {
                  if (!mint) return
                  e.dataTransfer.setData(
                    TIT_DND_MIME,
                    encodeTitDrag({
                      mint,
                      symbol: row.tokenSymbol || row.label || mint.slice(0, 6),
                    }),
                  )
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => {
                  setDiscoverHighlight(i)
                  if (mint) selectSignal(row)
                }}
                disabled={!mint || row.dropped}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-[var(--tit-motion)] hover:bg-[var(--tit-bg-2)] disabled:opacity-40 ${
                  active ? 'tit-row-active' : highlighted ? 'bg-[var(--tit-bg-2)]' : ''
                }`}
              >
                <span
                  className="tit-mono shrink-0 text-[0.6rem] uppercase"
                  style={{ color: verdictColor(row.verdict) }}
                >
                  {row.verdict === 'scanning' ? '…' : row.verdict.slice(0, 3)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--tit-text-0)]">
                  {row.tokenSymbol || row.label || truncMint(mint)}
                </span>
                {row.sample ? <span className="tit-sample-tag">sample</span> : null}
                <span className="tit-mono shrink-0 text-[0.6rem] text-[var(--tit-text-2)]">
                  {truncMint(mint)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="border-t border-white/[0.06] px-3 py-1.5 text-[0.55rem] text-[var(--tit-text-2)]">
        Focus a row → Arm sniper on ticket. Drag onto charts.
      </p>
    </aside>
  )
}
