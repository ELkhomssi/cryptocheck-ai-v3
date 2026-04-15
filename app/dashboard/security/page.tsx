'use client'

import { useEffect, useState } from 'react'

type Sec = {
  trust_score: number
  trust_note: string
  alerts: Array<{ action: string; created_at: string; metadata?: Record<string, unknown> }>
  recent_events: Array<{ action: string; created_at: string }>
}

export default function SecurityPage() {
  const [data, setData] = useState<Sec | null>(null)

  useEffect(() => {
    void fetch('/api/dashboard/security', { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data) return <p className="text-zinc-500">Loading…</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-semibold text-white">SENTINEL security</h1>
        <p className="mt-1 text-sm text-zinc-500">{data.trust_note}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Trust score</p>
          <p className="mt-2 font-mono text-4xl text-emerald-400">{data.trust_score}</p>
          <p className="mt-2 text-xs text-zinc-500">Heuristic — strengthen with edge TLS / device IDs in production.</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Alerts</p>
          <p className="mt-2 font-mono text-4xl text-amber-400">{data.alerts.length}</p>
          <p className="mt-2 text-xs text-zinc-500">Recent denied keys / scan errors.</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-zinc-400">Recent events</div>
        <ul className="max-h-96 divide-y divide-white/[0.04] overflow-y-auto">
          {(data.alerts.length > 0 ? data.alerts : data.recent_events ?? []).slice(0, 25).map((e) => (
            <li key={e.created_at + e.action} className="px-4 py-3 font-mono text-xs text-zinc-400">
              <span className="text-zinc-500">{new Date(e.created_at).toLocaleString()}</span>{' '}
              <span className="text-zinc-300">{e.action}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
