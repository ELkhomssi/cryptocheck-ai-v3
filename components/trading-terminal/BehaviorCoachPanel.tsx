'use client'

import { useCallback, useEffect, useState } from 'react'
import { detectBehaviorPatterns, type BehaviorFinding } from '@/lib/trading-terminal/behavior'
import { loadOverrideLog } from '@/lib/trading-terminal/coach-interrupt'
import { loadTradeLog } from '@/lib/trading-terminal/trade-log'
import { useTerminalFocus } from './TerminalFocusProvider'

export function BehaviorCoachPanel() {
  const { coachCollapsed, selectMint } = useTerminalFocus()
  const [findings, setFindings] = useState<BehaviorFinding[]>([])
  const [tradeCount, setTradeCount] = useState(0)

  const refresh = useCallback(() => {
    const trades = loadTradeLog()
    const overrides = loadOverrideLog()
    setTradeCount(trades.length)
    setFindings(detectBehaviorPatterns({ trades, overrides }))
  }, [])

  useEffect(() => {
    refresh()
    const t = window.setInterval(refresh, 8_000)
    return () => window.clearInterval(t)
  }, [refresh])

  if (coachCollapsed) {
    return (
      <div className="tit-panel px-3 py-2">
        <p className="tit-label">Behavior · collapsed (C)</p>
      </div>
    )
  }

  return (
    <section className="tit-panel flex min-h-0 flex-col overflow-hidden" aria-label="Behavioral coach">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <p className="tit-label">Coach · Behavior</p>
        <span className="tit-mono text-[0.55rem] text-[var(--tit-text-2)]">
          {tradeCount} local trade(s)
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tradeCount === 0 && findings.length === 0 ? (
          <p className="text-xs text-[var(--tit-text-1)]">
            No local fills yet. Patterns appear after confirmed swaps from this ticket (signature
            writeback). Nothing is invented.
          </p>
        ) : null}

        {findings.length === 0 && tradeCount > 0 ? (
          <p className="text-xs text-[var(--tit-text-1)]">
            No patterns matched current rules (override cluster, ignored warnings, whiplash,
            rapid re-entry, sample trading).
          </p>
        ) : null}

        <ul className="space-y-3">
          {findings.map((f) => (
            <li
              key={f.id}
              className={`rounded border px-2 py-2 ${
                f.tone === 'warn'
                  ? 'border-[var(--tit-warn)]/40 bg-[var(--tit-warn)]/5'
                  : 'border-white/10 bg-[var(--tit-bg-2)]'
              }`}
            >
              <p className="text-xs font-semibold text-[var(--tit-text-0)]">{f.title}</p>
              <p className="mt-1 text-xs text-[var(--tit-text-1)]">{f.detail}</p>
              <ul className="mt-1.5 space-y-0.5">
                {f.evidence.map((e, i) => (
                  <li key={i} className="tit-mono text-[0.55rem] text-[var(--tit-text-2)]">
                    · {e}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        {tradeCount > 0 ? (
          <button
            type="button"
            className="mt-3 text-[0.6rem] text-[var(--tit-text-2)] underline"
            onClick={() => {
              const t = loadTradeLog()[0]
              if (t) selectMint(t.mint, t.symbol)
            }}
          >
            Focus latest trade mint
          </button>
        ) : null}
      </div>
    </section>
  )
}
