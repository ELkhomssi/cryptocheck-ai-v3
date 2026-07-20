'use client'

import { useMemo } from 'react'
import { buildWeeklyBrief } from '@/lib/trading-terminal/weekly-brief'
import { useTerminalFocus } from './TerminalFocusProvider'

export function WeeklyBriefPanel() {
  const { coachCollapsed } = useTerminalFocus()
  const brief = useMemo(() => buildWeeklyBrief(), [])

  if (coachCollapsed) {
    return (
      <div className="tit-panel px-3 py-2">
        <p className="tit-label">Brief · collapsed (C)</p>
      </div>
    )
  }

  return (
    <section className="tit-panel flex min-h-0 flex-col overflow-hidden" aria-label="Weekly brief">
      <div className="border-b border-white/[0.06] px-3 py-2">
        <p className="tit-label">Terminal Brief #{brief.briefNumber}</p>
        <p className="tit-mono mt-0.5 text-[0.55rem] text-[var(--tit-text-2)]">
          Week of {brief.weekStartIso.slice(0, 10)} · generated {brief.generatedAt.slice(0, 19)}Z
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {brief.sections.map((s) => (
          <div key={s.id}>
            <div className="mb-1 flex items-center gap-2">
              <p className="tit-label">{s.title}</p>
              {s.status === 'unavailable' ? (
                <span className="tit-mono text-[0.5rem] uppercase text-[var(--tit-text-2)]">
                  unavailable
                </span>
              ) : null}
            </div>
            <ul className="space-y-1">
              {s.lines.map((line, i) => (
                <li
                  key={i}
                  className={`text-xs ${
                    s.status === 'unavailable'
                      ? 'text-[var(--tit-text-2)]'
                      : 'text-[var(--tit-text-1)]'
                  }`}
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
