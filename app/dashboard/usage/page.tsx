'use client'

import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Bundle = {
  series: { date: string; count: number }[]
  latency: { p50: number; p95: number; avg: number; sample: number }
  errors: { rate: number; errors: number; total: number }
  quota: { limit: number; used: number; remaining: number }
  runtimeTier: string
}

export default function UsagePage() {
  const [data, setData] = useState<Bundle | null>(null)

  useEffect(() => {
    void fetch('/api/dashboard/usage?days=30', { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data) {
    return <p className="text-zinc-500">Loading usage…</p>
  }

  const chartData = data.series.map((d) => ({ ...d, label: d.date.slice(5) }))
  const quotaPct = Math.min(100, (data.quota.used / Math.max(1, data.quota.limit)) * 100)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-semibold text-white">Usage</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Tier <span className="text-zinc-300">{data.runtimeTier}</span> — requests logged from API scans.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Quota used', `${data.quota.used} / ${data.quota.limit}`],
          ['Remaining', String(data.quota.remaining)],
          ['p95 latency (ms)', String(Math.round(data.latency.p95))],
          ['Error rate', `${(data.errors.rate * 100).toFixed(1)}%`],
        ].map(([a, b]) => (
          <div key={a} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-xs uppercase text-zinc-500">{a}</p>
            <p className="mt-1 font-mono text-lg text-white">{b}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-sm font-medium text-zinc-300">Daily requests</p>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} />
              <Tooltip
                contentStyle={{ background: '#0a0a0f', border: '1px solid #27272a' }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Area type="monotone" dataKey="count" stroke="#10b981" fill="url(#fill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] p-4">
        <p className="text-sm font-medium text-zinc-300">Quota</p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
            style={{ width: `${quotaPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Resets at UTC midnight. Sample size for latency: {data.latency.sample} events with duration metadata.
        </p>
      </div>
    </div>
  )
}
