'use client'

import type { CoachInterrupt, InterruptTriggerId } from '@/lib/trading-terminal/coach-interrupt'

type Props = {
  interrupts: CoachInterrupt[]
  overridden: boolean
  onOverride: () => void
  onMute: (id: InterruptTriggerId) => void
  onDismissSoft: () => void
}

export function CoachInterruptBanner({
  interrupts,
  overridden,
  onOverride,
  onMute,
  onDismissSoft,
}: Props) {
  if (interrupts.length === 0) return null

  const hard = interrupts.filter((i) => i.severity === 'hard')
  const soft = interrupts.filter((i) => i.severity === 'soft')
  const primary = hard[0] ?? soft[0]
  if (!primary) return null

  const isHard = primary.severity === 'hard'

  return (
    <div
      className={`mx-2 mt-2 rounded border px-3 py-2 ${
        isHard
          ? 'border-[var(--tit-neg)]/50 bg-[var(--tit-neg)]/10'
          : 'border-[var(--tit-warn)]/45 bg-[var(--tit-warn)]/10'
      }`}
      role="alertdialog"
      aria-label="Coach pre-trade interrupt"
    >
      <p className="tit-label mb-1">{isHard ? 'Hard block' : 'Coach interrupt'}</p>
      <p className="text-xs font-semibold text-[var(--tit-text-0)]">{primary.title}</p>
      <p className="mt-1 text-xs text-[var(--tit-text-1)]">{primary.detail}</p>
      <p className="mt-1 text-[0.55rem] text-[var(--tit-text-2)]">Source: {primary.source}</p>

      {interrupts.length > 1 ? (
        <ul className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-2">
          {interrupts.slice(1).map((i) => (
            <li key={i.id} className="text-[0.65rem] text-[var(--tit-text-2)]">
              · {i.title}
            </li>
          ))}
        </ul>
      ) : null}

      {isHard ? (
        <p className="mt-2 text-[0.65rem] text-[var(--tit-neg)]">
          No override — matches risk-gated-swap hard block (≥80).
        </p>
      ) : overridden ? (
        <p className="mt-2 text-[0.65rem] text-[var(--tit-text-2)]">
          Override logged. Ticket armed — proceed with care.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={onOverride} className="tit-btn-ember px-2 py-1 text-[0.65rem]">
            Override (O)
          </button>
          <button
            type="button"
            onClick={() => onMute(primary.id)}
            className="rounded border border-white/10 px-2 py-1 text-[0.65rem] text-[var(--tit-text-1)]"
          >
            Mute 24h
          </button>
          <button
            type="button"
            onClick={onDismissSoft}
            className="rounded border border-white/10 px-2 py-1 text-[0.65rem] text-[var(--tit-text-1)]"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
