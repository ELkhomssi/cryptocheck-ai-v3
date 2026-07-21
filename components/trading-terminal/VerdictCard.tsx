'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { scanToVerdictCard } from '@/lib/trading-terminal/map-verdict'
import type { TerminalVerdict } from '@/lib/trading-terminal/types'
import { useTerminalFocus } from './TerminalFocusProvider'

const VERDICT_COLOR: Record<TerminalVerdict, string> = {
  SAFE: 'var(--tit-safe)',
  CAUTION: 'var(--tit-caution)',
  HIGH_RISK: 'var(--tit-hot)',
  BLOCKED: 'var(--tit-blocked)',
  INSUFFICIENT_DATA: 'var(--tit-text-2)',
}

function actionFor(verdict: TerminalVerdict): string {
  if (verdict === 'SAFE') return 'Trade allowed — size carefully. DYOR.'
  if (verdict === 'CAUTION') return 'Review before buying. Risk is elevated.'
  if (verdict === 'HIGH_RISK') return 'Avoid or size minimal. Confirm friction required.'
  if (verdict === 'BLOCKED') return 'Do not trade. Hard block from risk engine.'
  return 'Wait — insufficient evidence for a verdict.'
}

export function VerdictCard() {
  const { scan, scanning, scanError, focusMint, coachCollapsed, focusSymbol } = useTerminalFocus()
  const card = scanToVerdictCard(scan)

  if (coachCollapsed) {
    return (
      <div className="tit-panel-flat px-3 py-2">
        <p className="tit-label">AI Coach · collapsed (C)</p>
      </div>
    )
  }

  const coveragePct = card ? Math.round(card.evidence.coverage * 100) : 0

  return (
    <section
      className="tit-panel-flat flex min-h-0 flex-col overflow-hidden"
      aria-label="AI Coach"
    >
      <div className="flex items-center justify-between border-b border-[var(--tit-border)] px-3 py-2">
        <div>
          <p className="text-[0.7rem] font-bold text-[var(--tit-text-0)]">AI Coach</p>
          <p className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">
            {focusSymbol || 'Select a token'}
          </p>
        </div>
        {card?.sample ? <span className="tit-sample-tag">sample</span> : null}
      </div>

      <div className="tit-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {!focusMint ? (
          <p className="text-[0.7rem] text-[var(--tit-text-1)]">
            Click Discover or search a mint — coach binds instantly.
          </p>
        ) : null}

        {scanning ? (
          <div className="flex items-center gap-2 text-[0.7rem] text-[var(--tit-text-1)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Scanning via gateway…
          </div>
        ) : null}

        {scanError ? (
          <p className="text-[0.7rem] text-[var(--tit-neg)]" role="alert">
            {scanError}
          </p>
        ) : null}

        {card && !scanning ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {(card.verdict === 'CAUTION' ||
                card.verdict === 'HIGH_RISK' ||
                card.verdict === 'BLOCKED') && (
                <AlertTriangle
                  className="h-5 w-5 shrink-0"
                  style={{ color: VERDICT_COLOR[card.verdict] }}
                />
              )}
              <span
                className="tit-mono text-xl font-black tracking-wide"
                style={{ color: VERDICT_COLOR[card.verdict] }}
              >
                {card.verdict === 'HIGH_RISK' ? 'HIGH RISK' : card.verdict.replace('_', ' ')}
              </span>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="tit-label">Evidence coverage</p>
                <span className="tit-mono text-[0.65rem] text-[var(--tit-text-1)]">
                  {card.evidence.present.length}/{card.evidence.required.length} ·{' '}
                  {card.confidenceBand}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--tit-bg-3)]">
                <div
                  className="h-full rounded-full transition-all duration-[var(--tit-motion)]"
                  style={{
                    width: `${coveragePct}%`,
                    background: VERDICT_COLOR[card.verdict],
                  }}
                />
              </div>
              <p className="mt-1 text-[0.5rem] text-[var(--tit-text-2)]">
                Not a precision confidence % — band from evidence coverage only.
              </p>
            </div>

            {card.safetyScore != null ? (
              <p className="tit-mono text-[0.65rem] text-[var(--tit-text-1)]">
                Safety {card.safetyScore}/100 · Risk {card.riskScore ?? '—'}
              </p>
            ) : null}

            {card.why.length > 0 ? (
              <div>
                <p className="tit-label mb-1">Why</p>
                <ul className="space-y-1.5">
                  {card.why.map((b, i) => (
                    <li key={i} className="flex gap-2 text-[0.7rem] text-[var(--tit-text-0)]">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--tit-accent)]" />
                      <span>
                        {b.text}
                        <span className="mt-0.5 block text-[0.5rem] text-[var(--tit-text-2)]">
                          {b.source}
                        </span>
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
                    <li key={i} className="text-[0.7rem] text-[var(--tit-warn)]">
                      · {b.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {card.opportunities.length > 0 ? (
              <div>
                <p className="tit-label mb-1">Opportunities</p>
                <ul className="space-y-1">
                  {card.opportunities.map((b, i) => (
                    <li key={i} className="text-[0.7rem] text-[var(--tit-pos)]">
                      · {b.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded border border-[var(--tit-border)] bg-[var(--tit-bg-2)] px-2.5 py-2">
              <p className="tit-label mb-1">Action</p>
              <p className="text-[0.7rem] font-medium text-[var(--tit-text-0)]">
                {actionFor(card.verdict)}
              </p>
            </div>
          </div>
        ) : null}

        {focusMint && !scanning && !scanError && !card ? (
          <p className="text-[0.7rem] text-[var(--tit-text-1)]">No verdict yet</p>
        ) : null}
      </div>
    </section>
  )
}
