'use client'

/**
 * Phase 16.4–16.6 — Module detail: memory, timeline, intelligence graph.
 * Graph shows real points only — no synthetic fill for missing history.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  IntelligenceModuleId,
  ModuleCardView,
  ModuleMemorySlot,
} from '@/types/intelligence'
import { IntelligenceModuleCard } from './IntelligenceModuleCard'

type DetailPayload = {
  card: ModuleCardView
  memory: ModuleMemorySlot[]
  timeline: Array<{ id: string; title: string; detail: string; at: string; kind: string }>
  graph: {
    days: number
    intelligenceScore: Array<{
      t: string
      score: number | null
      calibrating: boolean
      avgWorkerPerformance: number | null
      providerUptimePct: number | null
    }>
  }
}

export function ModuleDetailPanel({
  moduleId,
  onBack,
}: {
  moduleId: IntelligenceModuleId
  onBack: () => void
}) {
  const [days, setDays] = useState<7 | 30>(7)

  const detailQ = useQuery({
    queryKey: ['intelligence-module-detail', moduleId, days],
    queryFn: async () => {
      const res = await fetch(`/api/intelligence/modules/${moduleId}?days=${days}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Module detail unavailable')
      return (await res.json()) as DetailPayload
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const chartData = useMemo(() => {
    const rows = detailQ.data?.graph.intelligenceScore ?? []
    return rows
      .filter((r) => r.score != null && !r.calibrating)
      .map((r) => ({
        t: Date.parse(r.t),
        score: r.score as number,
        worker: r.avgWorkerPerformance,
        uptime: r.providerUptimePct,
      }))
  }, [detailQ.data])

  return (
    <div>
      <button type="button" className="pd-tab" onClick={onBack} style={{ marginBottom: 12 }}>
        ← All modules
      </button>

      {detailQ.isLoading ? <div className="pd-skeleton" style={{ height: 120 }} /> : null}
      {detailQ.data?.card ? (
        <div style={{ marginBottom: 14, pointerEvents: 'none' }}>
          <IntelligenceModuleCard module={detailQ.data.card} onOpen={() => {}} />
        </div>
      ) : null}

      <section className="pd-panel" style={{ padding: 16, marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14 }}>Memory</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {(detailQ.data?.memory ?? []).map((slot) => (
            <div key={slot.label}>
              <div style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}>{slot.label}</div>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  color: slot.idle ? 'var(--pd-text-dim)' : 'var(--pd-text)',
                  fontStyle: slot.idle ? 'italic' : undefined,
                }}
              >
                {slot.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="pd-panel" style={{ padding: 16, marginBottom: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 14 }}>Intelligence Graph</h2>
          <div className="pd-tabs">
            <button
              type="button"
              className={`pd-tab${days === 7 ? ' is-active' : ''}`}
              onClick={() => setDays(7)}
            >
              7D
            </button>
            <button
              type="button"
              className={`pd-tab${days === 30 ? ' is-active' : ''}`}
              onClick={() => setDays(30)}
            >
              30D
            </button>
          </div>
        </div>
        <div style={{ height: 220 }}>
          {chartData.length < 2 ? (
            <div className="pd-empty" style={{ padding: 24 }}>
              <h3>No score history yet</h3>
              <p>
                Graph stays empty until hourly intelligence_score_snapshots accumulate. Missing
                ranges are not interpolated.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="intelScoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--pd-accent)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--pd-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--pd-border-soft)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  tickFormatter={(t) =>
                    new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  }
                  tick={{
                    fill: 'var(--pd-text-faint)',
                    fontSize: 10,
                    fontFamily: 'var(--font-ibm-plex-mono)',
                  }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{
                    fill: 'var(--pd-text-faint)',
                    fontSize: 10,
                    fontFamily: 'var(--font-ibm-plex-mono)',
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--pd-surface)',
                    border: '1px solid var(--pd-border)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  name="Intelligence Score"
                  stroke="var(--pd-accent)"
                  strokeWidth={1.8}
                  fill="url(#intelScoreFill)"
                  connectNulls={false}
                  isAnimationActive
                  animationDuration={450}
                />
                <Line
                  type="monotone"
                  dataKey="uptime"
                  name="Provider uptime"
                  stroke="var(--pd-text-dim)"
                  strokeWidth={1.2}
                  dot={false}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="pd-panel" style={{ padding: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14 }}>Timeline</h2>
        {(detailQ.data?.timeline ?? []).length === 0 ? (
          <div className="pd-empty" style={{ padding: 18 }}>
            <h3>No module events yet</h3>
            <p>Timeline is a filtered slice of Mission Feed for this module’s workers.</p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(detailQ.data?.timeline ?? []).map((item) => (
              <li
                key={item.id}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid var(--pd-border-soft)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong style={{ fontSize: 13 }}>{item.title}</strong>
                  <span className="pd-num" style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}>
                    {new Date(item.at).toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--pd-text-dim)' }}>
                  {item.detail}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
