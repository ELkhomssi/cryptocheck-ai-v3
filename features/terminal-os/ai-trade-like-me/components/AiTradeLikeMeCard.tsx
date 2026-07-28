'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { mockAiTradeLikeMeProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import type { AiLearningStatus } from '@/features/terminal-os/shared/types'

/** Compact left-rail activator — opens full Trade Like Me workspace */
export function AiTradeLikeMeCard() {
  const setActiveNav = useTerminalOsStore((s) => s.setActiveNav)
  const autonomous = useTerminalOsStore((s) => s.featureFlags.autonomousTrading)
  const { state, trainAiFromMyTrading, busy } = useTradeLikeMeEngine()

  return (
    <div className="tos-panel tos-ai-activate tos-tlm-rail-card">
      <div className="tos-panel-body" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: 'var(--tos-accent-gold)',
            }}
          >
            Trade Like Me
          </span>
          <span className="tos-tlm-beta">AI</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--tos-text-secondary)', lineHeight: 1.45, marginBottom: 10 }}>
          Adaptive AI that learns <em>why</em> you trade — not copy-trading.
        </p>
        <div className="tos-tlm-rail-meta">
          <span>{state.phase.replace(/_/g, ' ')}</span>
          <span className="tos-num">{state.learningProgressPct}%</span>
        </div>
        <button
          type="button"
          className="tos-btn tos-btn-gold"
          style={{ width: '100%', marginBottom: 6 }}
          disabled={busy}
          onClick={() => void trainAiFromMyTrading()}
        >
          Train AI From My Trading
        </button>
        <button
          type="button"
          className="tos-btn tos-btn-ghost"
          style={{ width: '100%' }}
          onClick={() => setActiveNav('ai-trading')}
        >
          Open Desk
        </button>
        {!autonomous ? (
          <p className="tos-muted" style={{ fontSize: 10, marginTop: 8, lineHeight: 1.35 }}>
            Autonomy OFF — explainable advice only.
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function AiStatusCard() {
  const { state } = useTradeLikeMeEngine()
  const [fallback, setFallback] = useState<AiLearningStatus | null>(null)

  useEffect(() => {
    if (state.dna) return
    let c = false
    mockAiTradeLikeMeProvider.getLearningStatus().then((s) => {
      if (!c) setFallback(s)
    })
    return () => {
      c = true
    }
  }, [state.dna])

  const progress = state.dna ? state.learningProgressPct : fallback?.progressPct
  const phase = state.dna ? state.phase : fallback?.phase
  const why = state.dna
    ? `DNA confidence ${state.dna.confidenceScore}% · ${state.dna.tradingStyleSummary}`
    : fallback?.why

  return (
    <Panel title="AI Status">
      {progress == null ? (
        <PanelSkeleton rows={2} />
      ) : (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 6,
              fontSize: 11,
            }}
          >
            <span style={{ fontWeight: 700, color: 'var(--tos-accent-gold)' }}>
              {(phase ?? 'idle').toString().toUpperCase()}
            </span>
            <span className="tos-num">{progress}%</span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: 'var(--tos-border-subtle)',
              overflow: 'hidden',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'var(--tos-accent-gold)',
                transition: 'width 400ms ease',
                boxShadow: '0 0 12px color-mix(in srgb, var(--tos-accent-gold) 50%, transparent)',
              }}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--tos-text-secondary)', marginBottom: 4 }}>
            {state.statusLine}
          </p>
          <p className="tos-muted" style={{ fontSize: 10, lineHeight: 1.4 }}>
            {why}
          </p>
        </div>
      )}
    </Panel>
  )
}

export function AiAlertsFeed() {
  const [items, setItems] = useState<Awaited<
    ReturnType<typeof mockAiTradeLikeMeProvider.getAlerts>
  > | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { state } = useTradeLikeMeEngine()

  useEffect(() => {
    let c = false
    mockAiTradeLikeMeProvider
      .getAlerts(5)
      .then((a) => {
        if (!c) setItems(a)
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
    return () => {
      c = true
    }
  }, [])

  const live =
    state.lastDecision != null
      ? [
          {
            id: state.lastDecision.id,
            kind: 'coach' as const,
            title: state.lastDecision.action,
            body: state.lastDecision.summary,
            occurredAt: state.lastDecision.madeAt,
            confidence: state.lastDecision.scores.confidence,
          },
          ...(items ?? []),
        ].slice(0, 5)
      : items

  return (
    <Panel title="AI Alerts" live>
      {error ? (
        <EmptyState message={error} />
      ) : !live ? (
        <PanelSkeleton rows={3} />
      ) : live.length === 0 ? (
        <EmptyState message="No alerts yet — monitoring markets." />
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {live.map((a) => (
            <li
              key={a.id}
              style={{
                fontSize: 11,
                lineHeight: 1.4,
                borderLeft: '2px solid var(--tos-accent-gold)',
                paddingLeft: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--tos-text-primary)' }}>{a.title}</div>
              <div className="tos-secondary">{a.body}</div>
              <div className="tos-muted tos-num" style={{ marginTop: 2 }}>
                conf {a.confidence}%
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
