'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PerformancePoint, PerformanceResponse } from '@/types/portfolio-desk'
import { formatUsd } from '@/lib/portfolio-desk/format'

async function fetchPerf(wallet: string, range: string): Promise<PerformanceResponse> {
  const res = await fetch(
    `/api/portfolio/performance?wallet=${encodeURIComponent(wallet)}&range=${range}`,
    { cache: 'no-store' },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || 'Performance unavailable')
  }
  return (await res.json()) as PerformanceResponse
}

export function usePerformance(wallet: string | null, range: string) {
  return useQuery({
    queryKey: ['portfolio-performance', wallet, range],
    queryFn: () => fetchPerf(wallet!, range),
    enabled: Boolean(wallet && wallet.length >= 32),
    staleTime: 60_000,
  })
}

export function PerformanceChart({
  series,
  loading,
  note,
}: {
  series: PerformancePoint[]
  loading: boolean
  note?: string
}) {
  return (
    <section className="pd-panel">
      <div className="pd-panel-head">
        <h2>Performance</h2>
        <span style={{ fontSize: 12, color: 'var(--pd-text-dim)' }}>Total Value</span>
      </div>
      <div style={{ padding: 18, height: 260 }}>
        {loading ? (
          <div className="pd-skeleton" style={{ height: '100%', width: '100%' }} />
        ) : series.length < 2 ? (
          <div className="pd-empty" style={{ padding: 24 }}>
            <h3>No history yet</h3>
            <p>{note || 'CoinGecko/Birdeye history unavailable for held mints.'}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="pdPerfFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--pd-accent)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--pd-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                tickFormatter={(t) =>
                  new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                }
                tick={{ fill: 'var(--pd-text-faint)', fontSize: 10, fontFamily: 'var(--font-ibm-plex-mono)' }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
                tick={{ fill: 'var(--pd-text-faint)', fontSize: 10, fontFamily: 'var(--font-ibm-plex-mono)' }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--pd-surface)',
                  border: '1px solid var(--pd-border)',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v) => [formatUsd(Number(v)), 'Value']}
                labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
              />
              <Area
                type="monotone"
                dataKey="valueUsd"
                stroke="var(--pd-accent)"
                strokeWidth={1.8}
                fill="url(#pdPerfFill)"
                isAnimationActive
                animationDuration={450}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}

export function MiniSparkline({ series }: { series: PerformancePoint[] }) {
  if (series.length < 2) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          color: 'var(--pd-text-faint)',
          fontSize: 12,
        }}
      >
        Sparkline when history is available
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series}>
        <defs>
          <linearGradient id="pdSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pd-accent)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--pd-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="valueUsd"
          stroke="var(--pd-accent)"
          strokeWidth={1.8}
          fill="url(#pdSparkFill)"
          isAnimationActive
          animationDuration={400}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
