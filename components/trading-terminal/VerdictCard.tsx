'use client'

import { Loader2 } from 'lucide-react'
import { scanToVerdictCard } from '@/lib/trading-terminal/map-verdict'
import type { TerminalVerdict } from '@/lib/trading-terminal/types'
import { useTerminalFocus } from './TerminalFocusProvider'

const VERDICT_COLOR: Record<TerminalVerdict, string> = {
  SAFE: 'var(--tit-safe)',
  CAUTION: 'var(--tit-caution)',
  HIGH_RISK: 'var(--tit-warn)',
  BLOCKED: 'var(--tit-danger)',
  INSUFFICIENT_DATA: 'var(--tit-text-2)',
}

export function VerdictCard() {
  const { scan, scanning, scanError, focusMint, coachCollapsed } = useTerminalFocus()
  const card = scanToVerdictCard(scan)

  if (coachCollapsed) {
    return (
      <div className="tit-panel px-3 py-2">
        <p className="tit-label">Coach · collapsed (C)</p>
      </div>
    )
  }

  return (
    <section className="tit-panel flex min-h-0 flex-col overflow-hidden" aria-label="AI Coach">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <p className="tit-label">AI Coach · Token</p>
        {card?.sample ? <span className="tit-sample-tag">sample</span> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!focusMint ? (
          <p className="text-xs text-[var(--tit-text-1)]">Select a token</p>
        ) : null}

        {scanning ? (
          <div className="flex items-center gap-2 text-xs text-[var(--tit-text-1)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Scanning via gateway…
          </div>
        ) : null}

        {scanError ? (
          <p className="text-xs text-[var(--tit-neg)]" role="alert">
            {scanError}
          </p>
        ) : null}

        {card && !scanning ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="tit-mono rounded border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider"
                style={{
                  color: VERDICT_COLOR[card.verdict],
                  borderColor: VERDICT_COLOR[card.verdict],
                }}
              >
                {card.verdict.replace('_', ' ')}
              </span>
              <span className="tit-mono text-[0.65rem] text-[var(--tit-text-1)]">
                Evidence {card.evidence.present.length}/{card.evidence.required.length} ·{' '}
                {card.confidenceBand}
              </span>
            </div>

            {card.safetyScore != null ? (
              <p className="tit-mono text-xs text-[var(--tit-text-1)]">
                Safety {card.safetyScore}/100 · Risk {card.riskScore ?? '—'}
              </p>
            ) : null}

            {card.why.length > 0 ? (
              <div>
                <p className="tit-label mb-1">Why</p>
                <ul className="space-y-1">
                  {card.why.map((b, i) => (
                    <li key={i} className="text-xs text-[var(--tit-text-0)]">
                      {b.text}
                      <span className="mt-0.5 block text-[0.55rem] text-[var(--tit-text-2)]">
                        {b.source}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {card.risks.length > 0 ? (
              <div>
                <p className="tit-label mb-1">Risks</p>
                <ul className="space-y-1">
                  {card.risks.map((b, i) => (
                    <li key={i} className="text-xs text-[var(--tit-warn)]">
                      {b.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {card.opportunities.length === 0 ? null : (
              <div>
                <p className="tit-label mb-1">Opportunities</p>
                <ul className="space-y-1">
                  {card.opportunities.map((b, i) => (
                    <li key={i} className="text-xs text-[var(--tit-pos)]">
                      {b.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        {focusMint && !scanning && !scanError && !card ? (
          <p className="text-xs text-[var(--tit-text-1)]">No verdict yet</p>
        ) : null}
      </div>
    </section>
  )
}
