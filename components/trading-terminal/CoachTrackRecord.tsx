'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  loadOverrideLog,
  summarizeOverrideLog,
  type OverrideLogEntry,
} from '@/lib/trading-terminal/coach-interrupt'
import { useTerminalFocus } from './TerminalFocusProvider'

function truncMint(m: string) {
  return m.length < 10 ? m : `${m.slice(0, 4)}…${m.slice(-4)}`
}

export function CoachTrackRecord() {
  const { selectMint, coachCollapsed } = useTerminalFocus()
  const [entries, setEntries] = useState<OverrideLogEntry[]>([])

  const refresh = useCallback(() => {
    setEntries(loadOverrideLog())
  }, [])

  useEffect(() => {
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (e.key?.includes('coach-overrides')) refresh()
    }
    window.addEventListener('storage', onStorage)
    const t = window.setInterval(refresh, 5_000)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.clearInterval(t)
    }
  }, [refresh])

  if (coachCollapsed) {
    return (
      <div className="tit-panel px-3 py-2">
        <p className="tit-label">Track record · collapsed (C)</p>
      </div>
    )
  }

  const summary = summarizeOverrideLog(entries)
  const weekStart = new Date()
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7))
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekSummary = summarizeOverrideLog(entries, weekStart.toISOString())

  return (
    <section className="tit-panel flex min-h-0 flex-col overflow-hidden" aria-label="Coach track record">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <p className="tit-label">Coach · Track record</p>
        <button
          type="button"
          onClick={refresh}
          className="tit-mono text-[0.55rem] text-[var(--tit-text-2)] hover:text-[var(--tit-text-0)]"
        >
          Refresh
        </button>
      </div>

      <div className="border-b border-white/[0.06] px-3 py-2">
        <p className="tit-mono text-[0.65rem] text-[var(--tit-text-1)]">
          All-time {summary.total} · override {summary.overridden} · mute {summary.muted} · dismiss{' '}
          {summary.dismissed}
        </p>
        <p className="tit-mono mt-0.5 text-[0.6rem] text-[var(--tit-text-2)]">
          This week {weekSummary.sinceCount} actions · {weekSummary.sinceOverridden} overrides
        </p>
        <p className="mt-1 text-[0.55rem] text-[var(--tit-text-2)]">
          Auditable local log only. Misses are not hidden. Outcomes (PnL after override) ship when
          trade writeback lands.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="p-3 text-xs text-[var(--tit-text-1)]">
          No interrupt actions yet. Soft gates log override / mute / dismiss here — never fabricated
          rows.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {entries.map((e, i) => (
            <li key={`${e.at}-${e.mint}-${i}`} className="border-b border-white/[0.04] px-3 py-1.5">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => selectMint(e.mint)}
              >
                <div className="flex items-center gap-2 text-[0.65rem]">
                  <span className="tit-mono text-[var(--tit-text-2)]">
                    {e.at.slice(0, 19).replace('T', ' ')}
                  </span>
                  <span
                    className={`tit-mono uppercase ${
                      e.action === 'overridden'
                        ? 'text-[var(--tit-warn)]'
                        : e.action === 'muted'
                          ? 'text-[var(--tit-text-1)]'
                          : 'text-[var(--tit-text-2)]'
                    }`}
                  >
                    {e.action}
                  </span>
                  {e.verdict ? (
                    <span className="tit-mono text-[var(--tit-text-2)]">{e.verdict}</span>
                  ) : null}
                </div>
                <p className="tit-mono mt-0.5 text-[0.6rem] text-[var(--tit-text-1)]">
                  {e.side} · {truncMint(e.mint)} · {e.triggers.join(', ') || '—'}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
