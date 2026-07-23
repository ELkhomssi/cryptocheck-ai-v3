'use client'

/**
 * Opportunity Radar — conviction strip beneath charts.
 */

import { useMemo } from 'react'
import { resolveIntelligence } from '@/lib/trading-terminal/engines/resolve-intelligence'
import { useTerminalFocus } from './TerminalFocusProvider'
import { useTerminalPortfolio } from './MiniPortfolioCard'

function riskChip(level: string | undefined): string {
  if (level === 'HIGH') return 'tit-badge tit-badge-risk'
  if (level === 'MEDIUM') return 'tit-badge tit-badge-hot'
  return 'tit-badge tit-badge-safe'
}

export function ConvictionRadar() {
  const { dataMode, selectMint, setTicketSide, focusMint } = useTerminalFocus()
  const { data } = useTerminalPortfolio()

  const intel = useMemo(
    () =>
      resolveIntelligence({
        mode: dataMode,
        portfolioSummary: data?.summary ?? null,
        focusMint,
      }),
    [dataMode, data?.summary, focusMint],
  )

  const opportunities = intel.opportunities

  const onCard = (mint: string, symbol: string) => {
    selectMint(mint, symbol)
    setTicketSide('buy')
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[rgba(11,17,24,0.55)] px-2 py-1.5 backdrop-blur-sm">
      <div className="mb-1.5 flex shrink-0 items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <p className="tit-section-title">Opportunity Radar</p>
          <span className="tit-pulse" />
        </div>
        <span className="tit-mono text-[0.55rem] text-[var(--tit-text-2)]">
          {dataMode === 'demo' ? intel.methodNote : 'engine · live when feeds qualify'}
        </span>
      </div>
      {opportunities.length === 0 ? (
        <p className="px-1 text-[0.68rem] text-[var(--tit-text-1)]">
          No qualifying opportunities right now.
        </p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5">
          {opportunities.slice(0, 3).map((o, i) => {
            const active = o.mint === focusMint
            return (
              <button
                key={o.mint}
                type="button"
                onClick={() => onCard(o.mint, o.symbol)}
                className={`tit-intel-card flex min-h-0 flex-col justify-center px-3 py-2 text-left ${
                  active
                    ? '!border-[var(--tit-border-strong)] !bg-[var(--tit-bg-3)]'
                    : ''
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="tit-mono text-[0.55rem] font-bold text-[var(--tit-text-2)]">
                    #{i + 1}
                  </span>
                  <span className="tit-mono text-[0.85rem] font-bold text-[var(--tit-text-0)]">
                    {o.symbol}
                  </span>
                  <span className={riskChip(o.riskLevel)}>{o.riskLevel}</span>
                  <span className="tit-mono ml-auto text-[0.55rem] uppercase tracking-wide text-[var(--tit-text-2)]">
                    {o.stage}
                  </span>
                  <span className="tit-mono text-[0.8rem] font-bold text-[var(--tit-pos)]">
                    {o.convictionScore}
                  </span>
                </div>
                <p className="mt-1 truncate text-[0.62rem] text-[var(--tit-text-1)]">{o.whyNow}</p>
                <div className="tit-meter mt-1.5 h-1">
                  <span
                    className="tit-meter-fill"
                    style={{
                      width: `${Math.min(100, o.convictionScore)}%`,
                      background: 'linear-gradient(90deg, var(--tit-accent), var(--tit-pos))',
                    }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** @deprecated Prefer ConvictionRadar */
export { ConvictionRadar as IntelligenceBottom }
