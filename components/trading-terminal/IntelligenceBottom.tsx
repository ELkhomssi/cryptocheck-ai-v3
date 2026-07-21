'use client'

/**
 * PROMPT 26 — Opportunity Radar as ranked conviction cards.
 * Click fan-out: focus token → charts + intelligence column.
 */

import { useMemo } from 'react'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import { useTerminalFocus } from './TerminalFocusProvider'

function riskChip(level: string | undefined): string {
  if (level === 'HIGH') return 'tit-badge tit-badge-risk'
  if (level === 'MEDIUM') return 'tit-badge tit-badge-hot'
  return 'tit-badge tit-badge-safe'
}

export function ConvictionRadar() {
  const { dataMode, selectMint, setTicketSide, focusMint } = useTerminalFocus()
  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])

  const opportunities =
    dataMode === 'demo' && snap.coach.status === 'ready'
      ? [...snap.coach.data.opportunities].sort((a, b) => b.conviction - a.conviction)
      : []

  const onCard = (symbol: string) => {
    const tok =
      snap.discover.status === 'ready'
        ? snap.discover.data.find((d) => d.symbol === symbol)
        : null
    if (tok) {
      selectMint(tok.mint, tok.symbol)
      setTicketSide('buy')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-1 py-1">
      <div className="mb-1 flex shrink-0 items-center justify-between px-1">
        <p className="tit-label">Opportunity Radar</p>
        <span className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">
          {dataMode === 'demo' ? 'ranked by conviction' : 'live when feed qualifies'}
        </span>
      </div>
      {opportunities.length === 0 ? (
        <p className="px-1 text-[0.65rem] text-[var(--tit-text-1)]">
          No qualifying opportunities right now.
        </p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-1">
          {opportunities.slice(0, 3).map((o, i) => {
            const tok =
              snap.discover.status === 'ready'
                ? snap.discover.data.find((d) => d.symbol === o.symbol)
                : null
            const active = tok?.mint === focusMint
            return (
              <button
                key={o.symbol}
                type="button"
                onClick={() => onCard(o.symbol)}
                className={`flex min-h-0 flex-col justify-center rounded border px-2.5 py-1.5 text-left transition-colors duration-[var(--tit-motion)] ${
                  active
                    ? 'border-[var(--tit-accent)] bg-[var(--tit-bg-2)]'
                    : 'border-[var(--tit-border)] bg-[var(--tit-bg-1)] hover:bg-[var(--tit-bg-2)]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="tit-mono text-[0.55rem] font-bold text-[var(--tit-text-2)]">
                    #{i + 1}
                  </span>
                  <span className="tit-mono text-[0.8rem] font-bold text-[var(--tit-text-0)]">
                    {o.symbol}
                  </span>
                  <span className={riskChip(o.riskLevel)}>{o.riskLevel ?? 'MED'}</span>
                  <span className="tit-mono ml-auto text-[0.75rem] font-bold text-[var(--tit-pos)]">
                    {o.conviction}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[0.6rem] text-[var(--tit-text-1)]">{o.reason}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** @deprecated Prefer ConvictionRadar — kept as alias during migration. */
export { ConvictionRadar as IntelligenceBottom }
