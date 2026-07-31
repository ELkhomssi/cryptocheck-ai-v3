'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import type { AiAlertItem } from '@/features/terminal-os/shared/types'

/** Compact left-rail activator — opens full Trade Like Me workspace */
export function AiTradeLikeMeCard() {
  const setActiveNav = useTerminalOsStore((s) => s.setActiveNav)
  const autonomous = useTerminalOsStore((s) => s.featureFlags.autonomousTrading)
  const { state, trainAiFromMyTrading, busy } = useTradeLikeMeEngine()

  return (
    <div className="tos-panel tos-ai-activate tos-tlm-rail-card">
      <div className="tos-panel-body">
        <div className="tos-tlm-rail-head">
          <span className="tos-tlm-rail-title">Trade Like Me</span>
          <span className="tos-tlm-beta">AI</span>
        </div>
        <p className="tos-tlm-rail-copy">
          Adaptive AI that learns <em>why</em> you trade — not copy-trading.
        </p>
        <div className="tos-tlm-rail-meta">
          <span>{state.phase.replace(/_/g, ' ')}</span>
          <span className="tos-num">{state.learningProgressPct}%</span>
        </div>
        <button
          type="button"
          className="tos-btn tos-btn-gold"
          style={{ width: '100%', marginBottom: 'var(--tos-space-1)' }}
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
          <p className="tos-muted tos-tlm-rail-note">Autonomy OFF — explainable advice only.</p>
        ) : null}
      </div>
    </div>
  )
}

export function AiStatusCard() {
  const { state } = useTradeLikeMeEngine()
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)

  const progress = state.learningProgressPct
  const phase = state.phase
  const why = state.dna
    ? `DNA confidence ${state.dna.confidence}% · ${state.dna.tradingStyleSummary}`
    : walletConnected
      ? 'Connect complete — activate Train AI to capture on-chain history.'
      : 'Connect a Solana wallet to begin learning.'

  return (
    <Panel title="AI Status">
      {!walletConnected && !state.dna ? (
        <EmptyState message="Connect a wallet to show live learning status." />
      ) : (
        <div>
          <div className="tos-tlm-status-row">
            <span style={{ fontWeight: 'var(--tos-fw-bold)', color: 'var(--tos-accent-gold)' }}>
              {phase.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span className="tos-num">{progress}%</span>
          </div>
          <div className="tos-progress tos-progress--md">
            <div
              className="tos-progress-fill tos-progress-fill--gold"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="tos-tlm-rail-copy" style={{ marginBottom: 'var(--tos-space-1)' }}>
            {state.statusLine}
          </p>
          <p className="tos-muted tos-tlm-rail-note">
            {state.dna
              ? `DNA confidence ${state.dna.confidence}% · sample ${state.dna.sampleSize} (${state.dna.tradeCount} trades / ${state.dna.rejectionCount} rejections)`
              : why}
          </p>
        </div>
      )}
    </Panel>
  )
}

export function AiAlertsFeed() {
  const [error, setError] = useState<string | null>(null)
  const { state } = useTradeLikeMeEngine()
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const [fired, setFired] = useState<AiAlertItem[] | null>(null)

  useEffect(() => {
    if (!wallet) {
      setFired([])
      return
    }
    let c = false
    void fetch(`/api/terminal-os/alerts?wallet=${encodeURIComponent(wallet)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Alerts unavailable')
        const body = (await res.json()) as {
          fired?: { id: string; summary: string; firedAt: string; triggerValue: unknown }[]
        }
        if (c) return
        setFired(
          (body.fired ?? []).slice(0, 5).map((f) => ({
            id: f.id,
            kind: 'risk' as const,
            title: 'Alert fired',
            body: f.summary,
            occurredAt: f.firedAt,
            confidence: 70,
          })),
        )
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
    return () => {
      c = true
    }
  }, [wallet])

  const live: AiAlertItem[] =
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
          ...(fired ?? []),
        ].slice(0, 5)
      : fired ?? []

  return (
    <Panel title="AI Alerts" live>
      {error ? (
        <EmptyState message={error} />
      ) : fired == null && !state.lastDecision ? (
        <PanelSkeleton rows={2} />
      ) : live.length === 0 ? (
        <EmptyState message="No live AI alerts yet — train DNA or create an alert rule." />
      ) : (
        <ul className="tos-stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {live.map((a) => (
            <li key={a.id} style={{ fontSize: 'var(--tos-fs-sm)' }}>
              <strong>{a.title}</strong>
              <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)' }}>
                {a.body}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
