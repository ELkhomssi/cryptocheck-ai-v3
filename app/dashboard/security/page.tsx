'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/Dashboard/GlassCard'

type Sec = {
  trust_score: number
  trust_note: string
  alerts: Array<{ action: string; created_at: string; metadata?: Record<string, unknown> }>
  recent_events: Array<{ action: string; created_at: string }>
}

function severity(action: string): 'critical' | 'warn' | 'info' {
  if (action.includes('denied') || action.includes('error') || action.includes('revoked')) return 'critical'
  if (action.includes('warn') || action.includes('limit')) return 'warn'
  return 'info'
}

function rowClass(s: ReturnType<typeof severity>) {
  if (s === 'critical') return 'border-l-rose-400/50 bg-rose-500/[0.05]'
  if (s === 'warn') return 'border-l-amber-400/45 bg-amber-500/[0.04]'
  return 'border-l-emerald-400/30 bg-emerald-500/[0.03]'
}

export default function SecurityPage() {
  const [data, setData] = useState<Sec | null>(null)

  useEffect(() => {
    void fetch('/api/dashboard/security', { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data) {
    return <p className="text-sm font-medium tracking-wide text-slate-500">Loading SENTINEL intelligence…</p>
  }

  const rows = (data.alerts.length > 0 ? data.alerts : data.recent_events ?? []).slice(0, 40)

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">SENTINEL</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-200">Security intelligence</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">{data.trust_note}</p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6">
          <GlassCard accent="sentinel" className="p-6">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-500">Trust index</p>
            <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-emerald-300/95">
              {data.trust_score}
            </p>
            <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500">
              Heuristic — strengthen with edge TLS and device attestation in production environments.
            </p>
          </GlassCard>
        </div>
        <div className="col-span-12 md:col-span-6">
          <GlassCard className="p-6">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-500">Active anomalies</p>
            <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-amber-200/90">
              {data.alerts.length}
            </p>
            <p className="mt-3 text-xs font-medium text-slate-500">Denied keys, scan faults, and policy violations.</p>
          </GlassCard>
        </div>

        <div className="col-span-12">
          <GlassCard className="overflow-hidden p-0">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Threat event stream
              </p>
              <p className="mt-1 text-xs font-medium text-slate-400">Timestamped intelligence — severity color-coded</p>
            </div>
            <ul className="max-h-[420px] divide-y divide-white/[0.04] overflow-y-auto">
              {rows.length === 0 ? (
                <li className="px-5 py-10 text-center text-xs font-medium text-slate-500">
                  No threat events recorded in this window.
                </li>
              ) : (
                rows.map((e, i) => {
                  const sev = severity(e.action)
                  return (
                    <motion.li
                      key={e.created_at + e.action + i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1], delay: i * 0.015 }}
                      className={`border-l-2 px-4 py-3 font-mono text-[0.68rem] leading-snug ${rowClass(sev)}`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="tabular-nums text-slate-500">
                          {new Date(e.created_at).toLocaleString()}
                        </span>
                        <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {sev}
                        </span>
                      </div>
                      <div className="mt-1.5 text-slate-300">{e.action}</div>
                    </motion.li>
                  )
                })
              )}
            </ul>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
