'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { mockAiTradeLikeMeProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { AiLearningStatus } from '@/features/terminal-os/shared/types'

export function AiTradeLikeMeCard() {
  const setActiveNav = useTerminalOsStore((s) => s.setActiveNav)
  const autonomous = useTerminalOsStore((s) => s.featureFlags.autonomousTrading)

  return (
    <div className="tos-panel tos-ai-activate" style={{ background: 'var(--tos-bg-app)' }}>
      <div className="tos-panel-body" style={{ padding: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: 'var(--tos-text-primary)',
            }}
          >
            AI Trade Like Me
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--tos-accent-gold)',
              border: '1px solid color-mix(in srgb, var(--tos-accent-gold) 40%, transparent)',
              borderRadius: 4,
              padding: '1px 5px',
            }}
          >
            BETA
          </span>
        </div>
        <ol
          style={{
            margin: '0 0 10px',
            paddingLeft: 16,
            fontSize: 11,
            color: 'var(--tos-text-secondary)',
            lineHeight: 1.45,
          }}
        >
          <li>Connect wallet</li>
          <li>AI analyzes your trades</li>
          <li>AI trades like you{autonomous ? '' : ' (advise-only)'}</li>
        </ol>
        <button
          type="button"
          className="tos-btn tos-btn-gold"
          style={{ width: '100%' }}
          onClick={() => setActiveNav('ai-trading')}
        >
          ACTIVATE AI TRADING
        </button>
        {!autonomous ? (
          <p className="tos-muted" style={{ fontSize: 10, marginTop: 8, lineHeight: 1.35 }}>
            Autonomy flagged OFF — predictions only until Phase 6.
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function AiStatusCard() {
  const [status, setStatus] = useState<AiLearningStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    mockAiTradeLikeMeProvider
      .getLearningStatus()
      .then((s) => {
        if (!c) setStatus(s)
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
    return () => {
      c = true
    }
  }, [])

  return (
    <Panel title="AI Status">
      {error ? (
        <EmptyState message={error} />
      ) : !status ? (
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
              {status.phase.toUpperCase()}
            </span>
            <span className="tos-num">{status.progressPct}%</span>
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
                width: `${status.progressPct}%`,
                height: '100%',
                background: 'var(--tos-accent-gold)',
                transition: 'width 400ms ease',
              }}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--tos-text-secondary)', marginBottom: 4 }}>
            Analyzing: {status.analyzing.join(', ')}.
          </p>
          <p className="tos-muted" style={{ fontSize: 10, lineHeight: 1.4 }}>
            Why: {status.why}
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

  return (
    <Panel title="AI Alerts" live>
      {error ? (
        <EmptyState message={error} />
      ) : !items ? (
        <PanelSkeleton rows={3} />
      ) : items.length === 0 ? (
        <EmptyState message="No alerts yet — monitoring markets." />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((a) => (
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
