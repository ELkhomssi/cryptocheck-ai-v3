'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchMarkPrice } from '@/lib/trading-terminal/mark-price'
import {
  computeTradeOutcome,
  summarizeOutcomes,
  type TradeOutcome,
} from '@/lib/trading-terminal/trade-outcomes'
import { loadTradeLog } from '@/lib/trading-terminal/trade-log'
import { useTerminalFocus } from './TerminalFocusProvider'

function truncMint(m: string) {
  return m.length < 10 ? m : `${m.slice(0, 4)}…${m.slice(-4)}`
}

export function TradeOutcomesPanel() {
  const { selectMint, coachCollapsed } = useTerminalFocus()
  const [outcomes, setOutcomes] = useState<TradeOutcome[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const trades = loadTradeLog().slice(0, 20)
    if (trades.length === 0) {
      setOutcomes([])
      return
    }
    setLoading(true)
    try {
      const next: TradeOutcome[] = []
      for (const t of trades) {
        const mark = await fetchMarkPrice(t.mint)
        next.push(
          computeTradeOutcome(t, mark?.priceUsd ?? null, mark?.quotedAt ?? null),
        )
      }
      setOutcomes(next)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (coachCollapsed) {
    return (
      <div className="tit-panel px-3 py-2">
        <p className="tit-label">Outcomes · collapsed</p>
      </div>
    )
  }

  const summary = summarizeOutcomes(outcomes)

  return (
    <section className="tit-panel flex min-h-0 flex-col overflow-hidden" aria-label="Trade outcomes">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <p className="tit-label">Coach · Outcomes</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="tit-mono text-[0.55rem] text-[var(--tit-text-2)] hover:text-[var(--tit-text-0)]"
        >
          {loading ? 'Marking…' : 'Refresh marks'}
        </button>
      </div>

      <div className="border-b border-white/[0.06] px-3 py-2">
        <p className="tit-mono text-[0.65rem] text-[var(--tit-text-1)]">
          Marked {summary.marked} · unavailable {summary.unavailable}
          {summary.avgDeltaPct != null
            ? ` · avg Δ ${summary.avgDeltaPct >= 0 ? '+' : ''}${summary.avgDeltaPct.toFixed(1)}%`
            : ''}
        </p>
        <p className="mt-1 text-[0.55rem] text-[var(--tit-text-2)]">
          Price Δ from DexScreener marks only — not wallet PnL. Missing entry mark → withheld.
        </p>
      </div>

      {outcomes.length === 0 ? (
        <p className="p-3 text-xs text-[var(--tit-text-1)]">
          No local trades. Confirmed ticket swaps appear here after signature writeback.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {outcomes.map((o) => (
            <li
              key={o.trade.signature}
              className="border-b border-white/[0.04] px-3 py-1.5"
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => selectMint(o.trade.mint, o.trade.symbol)}
              >
                <div className="flex items-center gap-2 text-[0.65rem]">
                  <span className="font-medium text-[var(--tit-text-0)]">{o.trade.symbol}</span>
                  <span className="tit-mono uppercase text-[var(--tit-text-2)]">{o.trade.side}</span>
                  {o.status === 'marked' && o.priceDeltaPct != null ? (
                    <span
                      className={`tit-mono ml-auto ${
                        o.priceDeltaPct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                      }`}
                    >
                      {o.priceDeltaPct >= 0 ? '+' : ''}
                      {o.priceDeltaPct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="tit-mono ml-auto text-[var(--tit-text-2)]">—</span>
                  )}
                </div>
                <p className="tit-mono mt-0.5 text-[0.55rem] text-[var(--tit-text-2)]">
                  {truncMint(o.trade.mint)} · entry{' '}
                  {o.entryPriceUsd != null ? `$${o.entryPriceUsd.toPrecision(4)}` : 'n/a'} · mark{' '}
                  {o.markPriceUsd != null ? `$${o.markPriceUsd.toPrecision(4)}` : 'n/a'}
                </p>
                <p className="text-[0.5rem] text-[var(--tit-text-2)]">{o.note}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
