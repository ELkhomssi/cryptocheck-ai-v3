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

function severityStyles(s: StreamEvent['severity']) {
  switch (s) {
    case 'critical':
      return 'text-rose-300/95 border-l-rose-400/50 bg-rose-500/[0.06]'
    case 'warn':
      return 'text-amber-200/90 border-l-amber-400/45 bg-amber-500/[0.05]'
    default:
      return 'text-slate-300/95 border-l-emerald-400/35 bg-emerald-500/[0.04]'
  }
}

export function ActivityStream({ initial }: { initial: StreamEvent[] }) {
  const [rows, setRows] = useState<StreamEvent[]>(initial)

  useEffect(() => {
    setRows(initial)
  }, [initial])

  return (
    <div className="relative flex max-h-[320px] flex-col gap-0 overflow-hidden rounded-lg">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[rgba(10,10,11,0.92)] to-transparent" />
      <div className="max-h-[320px] space-y-0 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs font-medium tracking-wide text-slate-500">
              No threat events in the current window. Intelligence pipeline idle.
            </p>
          ) : (
            rows.map((e) => {
              const sev = e.severity ?? inferSeverity(e.action)
              return (
                <motion.div
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className={`border-l-2 border-b border-b-white/[0.04] px-3 py-2.5 font-mono text-[0.68rem] leading-snug ${severityStyles(sev)}`}
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
