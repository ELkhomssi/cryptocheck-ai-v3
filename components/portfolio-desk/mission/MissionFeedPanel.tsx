'use client'

/**
 * Mission Feed — chronological alerts + agent completions.
 * Honest empty state; never fabricates rows.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import type { AgentActivityRow } from '@/types/agents'
import type { PortfolioAlert } from '@/types/portfolio-desk'

type FeedCat = 'all' | 'market' | 'risk' | 'automation' | 'portfolio'

type FeedItem = {
  id: string
  cat: FeedCat
  title: string
  detail: string
  at: string
}

const FILTERS: { id: FeedCat; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'market', label: 'Market' },
  { id: 'risk', label: 'Risk' },
  { id: 'automation', label: 'Automation' },
  { id: 'portfolio', label: 'Portfolio' },
]

function alertCategory(type: string): FeedCat {
  if (type.includes('rug') || type.includes('authority') || type === 'risk') return 'risk'
  if (type.includes('whale') || type.includes('smart') || type.includes('liquidity') || type.includes('listing'))
    return 'market'
  return 'portfolio'
}

export function MissionFeedPanel({ limit = 40, condensed = false }: { limit?: number; condensed?: boolean }) {
  const { walletAddress } = useSolana()
  const [cat, setCat] = useState<FeedCat>('all')

  const alertsQ = useQuery({
    queryKey: ['mission-feed-alerts', walletAddress],
    queryFn: async () => {
      const q = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : ''
      const res = await fetch(`/api/portfolio/alerts${q}`, { cache: 'no-store' })
      if (!res.ok) return [] as PortfolioAlert[]
      const body = (await res.json()) as { alerts?: PortfolioAlert[] }
      return body.alerts ?? []
    },
    refetchInterval: 20_000,
    staleTime: 10_000,
  })

  const activityQ = useQuery({
    queryKey: ['mission-feed-activity', limit],
    queryFn: async () => {
      const res = await fetch(`/api/agents/activity?limit=${limit}`, { cache: 'no-store' })
      if (!res.ok) return [] as AgentActivityRow[]
      const body = (await res.json()) as { activity?: AgentActivityRow[] }
      return body.activity ?? []
    },
    refetchInterval: 15_000,
    staleTime: 8_000,
  })

  const items = useMemo(() => {
    const out: FeedItem[] = []
    for (const a of alertsQ.data ?? []) {
      out.push({
        id: `alert-${a.id}`,
        cat: alertCategory(a.type),
        title: a.title || a.type,
        detail: a.description || '',
        at: a.createdAt,
      })
    }
    for (const row of activityQ.data ?? []) {
      if (row.status === 'running') continue
      out.push({
        id: `act-${row.id}`,
        cat: 'automation',
        title: row.description || `${row.kind} ${row.status}`,
        detail: row.status === 'failed' ? 'Failed' : 'Completed',
        at: row.createdAt,
      })
    }
    out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    return out
  }, [alertsQ.data, activityQ.data])

  const filtered = items.filter((i) => (cat === 'all' ? true : i.cat === cat))
  const shown = condensed ? filtered.slice(0, 8) : filtered
  const loading = alertsQ.isLoading || activityQ.isLoading

  return (
    <section className={condensed ? undefined : 'pd-panel'} style={{ padding: condensed ? 0 : 16 }}>
      {!condensed ? (
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
        <div style={{ padding: condensed ? 0 : 8 }}>
          <div className="pd-skeleton" style={{ height: 28, marginBottom: 8 }} />
          <div className="pd-skeleton" style={{ height: 28, marginBottom: 8 }} />
          <div className="pd-skeleton" style={{ height: 28 }} />
        </div>
      ) : null}

      {!loading && shown.length === 0 ? (
        <div className="pd-empty" style={{ padding: condensed ? 18 : 28 }}>
          <h3>No mission events yet</h3>
          <p>
            The feed stays empty until real alerts or automation completions arrive. Nothing is
            fabricated.
          </p>
        </div>
      ) : null}

      {!loading && shown.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {shown.map((item) => (
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
              {item.detail ? (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--pd-text-dim)' }}>
                  {item.detail}
                </p>
              ) : null}
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 6,
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--pd-text-faint)',
                }}
              >
                {item.cat}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
