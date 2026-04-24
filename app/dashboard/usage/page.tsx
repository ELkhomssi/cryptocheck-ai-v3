'use client'

import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { GlassCard } from '@/components/Dashboard/GlassCard'

type Bundle = {
  series: { date: string; count: number }[]
  latency: { p50: number; p95: number; avg: number; sample: number }
  errors: { rate: number; errors: number; total: number }
  quota: { limit: number; used: number; remaining: number }
  runtimeTier: string
  scanPipeline?: { p50: number; p95: number; p99: number; avg: number; sample: number } | null
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
    return (
      <p className="font-mono-terminal text-base text-slate-500 motion-safe:animate-pulse">
        Loading intelligence operations…
      </p>
    )
  }

  const chartData = data.series.map((d) => ({ ...d, label: d.date.slice(5) }))
  const quotaPct = Math.min(100, (data.quota.used / Math.max(1, data.quota.limit)) * 100)
  const sentinelMode = ['institutional', 'pro'].includes(data.runtimeTier)

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <p className="font-space text-xs font-bold uppercase tracking-[0.22em] text-cyan-400/80">
          Intelligence operations
        </p>
        <h1 className="mt-2 font-space text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
          Throughput &amp; latency
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-400">
          Runtime tier{' '}
          <span className="font-mono-terminal font-bold text-cyan-200/90">{data.runtimeTier}</span> — security analyses
          and API intelligence routes.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {[
          {
            label: 'Operations today',
            value: `${data.quota.used.toLocaleString()} / ${data.quota.limit.toLocaleString()}`,
            hint: 'Intelligence cycles allocated against your daily system capacity.',
          },
          {
            label: 'Headroom',
            value: data.quota.remaining.toLocaleString(),
            hint: 'Remaining analyses before UTC midnight reset.',
          },
          {
            label: 'p95 latency',
            value: `${Math.round(data.latency.p95)} ms`,
            hint: 'End-to-end intelligence pipeline — sampled events only.',
          },
          {
            label: 'Pipeline reliability',
            value: `${(100 - data.errors.rate * 100).toFixed(1)}%`,
            hint: `Derived from ${data.errors.total.toLocaleString()} monitored events (${data.errors.errors} anomalies).`,
          },
          ...(data.scanPipeline
            ? [
                {
                  label: 'Scan API p95 (cache miss)',
                  value: `${Math.round(data.scanPipeline.p95)} ms`,
                  hint: `POST /api/v1/scan — ${data.scanPipeline.sample.toLocaleString()} instrumented runs (p99 ${Math.round(
                    data.scanPipeline.p99
                  )} ms).`,
                },
              ]
            : []),
        ].map((card) => (
          <div key={card.label} className="col-span-12 sm:col-span-6 xl:col-span-3">
            <GlassCard accent={sentinelMode ? 'sentinel' : 'default'} className="h-full p-5">
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
              <p className="mt-3 font-semibold tabular-nums text-lg text-slate-200">{card.value}</p>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{card.hint}</p>
            </GlassCard>
          </div>
        ))}

        <div className="col-span-12">
          <GlassCard accent={sentinelMode ? 'sentinel' : 'default'} className="p-5">
            <p className="text-sm font-semibold text-slate-200">Daily intelligence volume</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Smooth curve — no grid noise</p>
            <div className="mt-5 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="intel-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(45, 212, 191)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="rgb(45, 212, 191)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    stroke="rgba(148,163,184,0.25)"
                    tick={{ fill: 'rgba(148,163,184,0.75)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(148,163,184,0.25)"
                    tick={{ fill: 'rgba(148,163,184,0.75)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(10,10,11,0.92)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#e2e8f0',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="rgb(45, 212, 191)"
                    strokeWidth={2}
                    fill="url(#intel-fill)"
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0, fill: 'rgb(34, 211, 238)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        <div className="col-span-12">
          <GlassCard className="p-5">
            <p className="text-sm font-semibold text-slate-200">System capacity</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Resets at UTC midnight · Latency sample: {data.latency.sample.toLocaleString()} instrumented events
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600/90 to-cyan-500/85 shadow-[0_0_16px_rgba(16,185,129,0.25)] transition-[width] duration-700 ease-out"
                style={{ width: `${quotaPct}%` }}
              />
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
