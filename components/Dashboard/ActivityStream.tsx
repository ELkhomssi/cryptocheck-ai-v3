'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

export type StreamEvent = {
  id: string
  action: string
  created_at: string
  severity?: 'info' | 'warn' | 'critical'
}

function inferSeverity(action: string): StreamEvent['severity'] {
  if (action.includes('denied') || action.includes('error') || action.includes('revoked')) return 'critical'
  if (action.includes('warn') || action.includes('limit')) return 'warn'
  return 'info'
}

function severityStyles(s: StreamEvent['severity'], forensic: boolean) {
  if (forensic) {
    switch (s) {
      case 'critical':
        return 'border-rose-400/35 bg-rose-500/[0.08] text-rose-100'
      case 'warn':
        return 'border-amber-400/40 bg-amber-500/[0.08] text-amber-50'
      default:
        return 'border-cyan-400/30 bg-cyan-500/[0.06] text-slate-100'
    }
  }
  switch (s) {
    case 'critical':
      return 'text-rose-300/95 border-l-rose-400/50 bg-rose-500/[0.06]'
    case 'warn':
      return 'text-amber-200/90 border-l-amber-400/45 bg-amber-500/[0.05]'
    default:
      return 'text-slate-300/95 border-l-emerald-400/35 bg-emerald-500/[0.04]'
  }
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function ActivityStream({
  initial,
  variant = 'default',
}: {
  initial: StreamEvent[]
  variant?: 'default' | 'forensic'
}) {
  const [rows, setRows] = useState<StreamEvent[]>(initial)
  const forensic = variant === 'forensic'

  useEffect(() => {
    setRows(initial)
  }, [initial])

  return (
    <div
      className={`relative flex max-h-[320px] flex-col gap-0 overflow-hidden ${forensic ? 'rounded-xl' : 'rounded-lg'}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-8 ${
          forensic
            ? 'bg-gradient-to-b from-[#020617] to-transparent'
            : 'bg-gradient-to-b from-[rgba(10,10,11,0.92)] to-transparent'
        }`}
      />
      <div className="max-h-[320px] space-y-0 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {rows.length === 0 ? (
            <p
              className={`px-3 py-6 text-center text-xs font-medium tracking-wide ${
                forensic ? 'font-mono-terminal text-cyan-200/50' : 'text-slate-500'
              }`}
            >
              No threat events in the current window. Intelligence pipeline idle.
            </p>
          ) : (
            rows.map((e) => {
              const sev = e.severity ?? inferSeverity(e.action)
              if (forensic) {
                const chip =
                  sev === 'critical' ? 'text-rose-200' : sev === 'warn' ? 'text-amber-200' : 'text-emerald-200'
                return (
                  <motion.div
                    key={e.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className={`mb-2 rounded-lg border px-3 py-2.5 font-mono-terminal text-[0.68rem] leading-snug ${severityStyles(sev, true)}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 tabular-nums text-cyan-200/70">{formatTs(e.created_at)}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${chip} border-white/10 bg-black/30`}>
                        Complete
                      </span>
                      <span
                        className={`ml-auto rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          sev === 'critical'
                            ? 'border-rose-400/40 text-rose-200'
                            : sev === 'warn'
                              ? 'border-amber-400/40 text-amber-200'
                              : 'border-cyan-400/35 text-cyan-200'
                        }`}
                      >
                        {sev}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[0.7rem] text-slate-200/95">{e.action}</div>
                  </motion.div>
                )
              }
              return (
                <motion.div
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className={`border-l-2 border-b border-b-white/[0.04] px-3 py-2.5 font-mono text-[0.68rem] leading-snug ${severityStyles(sev, false)}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {new Date(e.created_at).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      })}
                    </span>
                    <span className="min-w-0 truncate text-right uppercase tracking-wide text-[0.58rem] text-slate-500">
                      {sev}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-300">{e.action}</div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
