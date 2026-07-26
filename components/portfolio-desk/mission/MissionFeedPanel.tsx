'use client'

/**
 * Mission Feed — chronological timeline.
 * Phase 17.2: reads timeline_events (DB-trigger populated).
 * Phase 17.1: condensed view uses clock + minimal headlines.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatTimelineClock, timelineHeadline } from '@/lib/portfolio-desk/mission-narrative'
import type { IntelligenceModuleId } from '@/types/intelligence'
import type { TimelineEvent } from '@/types/intelligence-core'

type FeedCat =
  | 'all'
  | 'market'
  | 'risk'
  | 'automation'
  | 'portfolio'
  | 'trading'
  | 'security'
  | 'launch'
  | 'research'

const FILTERS: { id: FeedCat; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'market', label: 'Market' },
  { id: 'risk', label: 'Risk' },
  { id: 'automation', label: 'Automation' },
  { id: 'portfolio', label: 'Portfolio' },
]

function catFor(ev: TimelineEvent): FeedCat {
  if (ev.module === 'security') return 'risk'
  if (ev.module === 'market') return 'market'
  if (ev.module === 'portfolio') return 'portfolio'
  if (ev.module === 'trading') return 'trading'
  if (ev.sourceTable === 'agent_activity') return 'automation'
  if (ev.eventType.startsWith('alert:risk') || ev.eventType.includes('rug')) return 'risk'
  return (ev.module as FeedCat) || 'automation'
}

export function MissionFeedPanel({
  limit = 40,
  condensed = false,
  moduleFilter = null,
}: {
  limit?: number
  condensed?: boolean
  moduleFilter?: IntelligenceModuleId | null
}) {
  const [cat, setCat] = useState<FeedCat>('all')

  const timelineQ = useQuery({
    queryKey: ['intelligence-core-timeline', limit, moduleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) })
      if (moduleFilter) params.set('module', moduleFilter)
      const res = await fetch(`/api/intelligence-core/timeline?${params}`, { cache: 'no-store' })
      if (!res.ok) return [] as TimelineEvent[]
      const body = (await res.json()) as { events?: TimelineEvent[] }
      return body.events ?? []
    },
    refetchInterval: 15_000,
    staleTime: 8_000,
  })

  const items = useMemo(() => {
    return (timelineQ.data ?? []).map((ev) => ({
      id: ev.id,
      cat: catFor(ev),
      title: timelineHeadline(ev),
      at: ev.createdAt,
    }))
  }, [timelineQ.data])

  const filtered = items.filter((i) => {
    if (moduleFilter) return true
    return cat === 'all' ? true : i.cat === cat || (cat === 'risk' && i.cat === 'security')
  })
  const shown = condensed ? filtered.slice(0, 8) : filtered
  const loading = timelineQ.isLoading

  if (condensed) {
    return (
      <div>
        {loading ? (
          <div>
            <div className="pd-skeleton" style={{ height: 22, marginBottom: 8 }} />
            <div className="pd-skeleton" style={{ height: 22, marginBottom: 8 }} />
            <div className="pd-skeleton" style={{ height: 22 }} />
          </div>
        ) : null}
        {!loading && shown.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--pd-text-dim)', lineHeight: 1.5 }}>
            I don’t have enough memory yet. Events appear here as they happen.
          </p>
        ) : null}
        {!loading && shown.length > 0 ? (
          <ul className="mc-timeline">
            {shown.map((item) => (
              <li key={item.id}>
                <time dateTime={item.at}>{formatTimelineClock(item.at)}</time>
                <strong>{item.title}</strong>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  return (
    <section className="pd-panel" style={{ padding: 16 }}>
      {!moduleFilter ? (
        <div className="pd-tabs" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`pd-tab${cat === f.id ? ' is-active' : ''}`}
              onClick={() => setCat(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: 8 }}>
          <div className="pd-skeleton" style={{ height: 28, marginBottom: 8 }} />
          <div className="pd-skeleton" style={{ height: 28, marginBottom: 8 }} />
          <div className="pd-skeleton" style={{ height: 28 }} />
        </div>
      ) : null}

      {!loading && shown.length === 0 ? (
        <div className="pd-empty" style={{ padding: 28 }}>
          <h3>No mission events yet</h3>
          <p>
            The unified timeline stays empty until real alerts, agent activity, or order updates
            arrive. Nothing is fabricated.
          </p>
        </div>
      ) : null}

      {!loading && shown.length > 0 ? (
        <ul className="mc-timeline">
          {shown.map((item) => (
            <li key={item.id}>
              <time dateTime={item.at}>{formatTimelineClock(item.at)}</time>
              <div>
                <strong>{item.title}</strong>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
