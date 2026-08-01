'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import type { ScoutDashboardState } from '@/lib/scout/types'

const EMPTY: ScoutDashboardState = {
  status: 'idle',
  trendingTopics: [],
  keywordOpportunities: [],
  todayPlan: null,
  recentArticles: [],
  publicationQueue: [],
  distributions: [],
  metrics: {
    articlesPublished: 0,
    articlesIndexed: null,
    rankingKeywords: null,
    organicUsers: null,
    trafficGrowthPct: null,
    queueDepth: 0,
    avgQualityScore: null,
    generatedAt: new Date().toISOString(),
    sample: true,
  },
  learning: [],
  lastError: null,
  updatedAt: new Date().toISOString(),
}

export function ScoutPanel() {
  const [state, setState] = useState<ScoutDashboardState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/scout/status', { cache: 'no-store' })
      if (!res.ok) throw new Error('status_failed')
      const json = (await res.json()) as ScoutDashboardState
      setState(json)
    } catch {
      setMessage('Unable to load Scout status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const runCycle = () => {
    setMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/scout/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxArticles: 2 }),
        })
        const json = (await res.json()) as { ok?: boolean; state?: ScoutDashboardState; error?: string }
        if (!res.ok) {
          setMessage(json.error === 'unauthorized' ? 'Operator auth required to run Scout' : json.error ?? 'Run failed')
          return
        }
        if (json.state) setState(json.state)
        setMessage('Cycle complete — drafts queued for approval')
      } catch {
        setMessage('Scout cycle failed')
      }
    })
  }

  if (loading) {
    return (
      <Panel title="Scout">
        <PanelSkeleton rows={6} />
      </Panel>
    )
  }

  return (
    <div className="tos-stack">
      <Panel title="Scout — Growth Intelligence">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div>
            <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)' }}>
              Status
            </div>
            <div style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {pending ? 'running' : state.status}
            </div>
          </div>
          <button
            type="button"
            className="tos-nav-item"
            data-active="false"
            disabled={pending}
            onClick={runCycle}
            style={{ border: '1px solid var(--tos-border)', padding: '8px 12px' }}
          >
            Run research cycle
          </button>
          {message ? <span className="tos-muted">{message}</span> : null}
        </div>
        <p className="tos-muted" style={{ marginTop: 12, fontSize: 'var(--tos-fs-sm)', lineHeight: 1.5 }}>
          Scout consumes market feeds, Market Analyst, and scan-gateway — it never invents analysis. Publishing is
          approval-based unless auto-publish is enabled.
        </p>
      </Panel>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--tos-space-3)',
        }}
      >
        <Panel title="SEO / Traffic">
          <Stat label="Articles published" value={String(state.metrics.articlesPublished)} />
          <Stat label="Queue depth" value={String(state.metrics.queueDepth)} />
          <Stat
            label="Avg quality"
            value={state.metrics.avgQualityScore != null ? `${state.metrics.avgQualityScore}` : '—'}
          />
          {state.metrics.sample ? (
            <p className="tos-muted" style={{ marginTop: 8, fontSize: 'var(--tos-fs-xs)' }}>
              GSC traffic metrics pending wiring · sample
            </p>
          ) : null}
        </Panel>
        <Panel title="Learning">
          {state.learning.length === 0 ? (
            <EmptyState message="No learning signals yet — run a cycle." />
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 'var(--tos-fs-sm)' }}>
              {state.learning.slice(0, 5).map((l) => (
                <li key={l.id}>{l.signal}</li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Trending topics">
        {state.trendingTopics.length === 0 ? (
          <EmptyState message="No live topics yet. Run a research cycle when feeds are configured." />
        ) : (
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 'var(--tos-fs-sm)' }}>
            {state.trendingTopics.slice(0, 8).map((t) => (
              <li key={t.id}>
                <strong>{t.title}</strong> · {t.source}
                <div className="tos-muted">{t.evidenceLine}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Publication queue">
        {state.publicationQueue.length === 0 ? (
          <EmptyState message="Queue empty." />
        ) : (
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 'var(--tos-fs-sm)' }}>
            {state.publicationQueue.slice(0, 10).map((a) => (
              <li key={a.id}>
                {a.title} · {a.status} · quality {a.quality?.score ?? '—'}/100
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Today's plan">
        {!state.todayPlan ? (
          <EmptyState message="No plan generated yet." />
        ) : (
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 'var(--tos-fs-sm)' }}>
            {state.todayPlan.items.slice(0, 12).map((item) => (
              <li key={item.id}>
                [{item.kind}] {item.title} · impact {Math.round(item.expectedImpact)}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--tos-fs-lg)', fontWeight: 600 }}>{value}</div>
    </div>
  )
}
