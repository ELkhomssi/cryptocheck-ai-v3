'use client'

import React, { useCallback, useEffect, useState } from 'react'

export type CopilotDecisionJson = {
  action: 'BUY' | 'WAIT' | 'AVOID'
  confidence: number
  entry_range: [number, number]
  exit_window: string
  reasoning: string
}

type Props = {
  mint: string
  enabled: boolean
}

export default function CopilotDecisionPanel({ mint, enabled }: Props) {
  const [decision, setDecision] = useState<CopilotDecisionJson | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const m = mint.trim()
    if (!enabled || m.length < 32) {
      setDecision(null)
      setErr(null)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/trading-os/copilot/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: m }),
        credentials: 'include',
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDecision(null)
        setErr(typeof j?.error === 'string' ? j.error : `HTTP ${res.status}`)
        return
      }
      setDecision(j as CopilotDecisionJson)
    } catch (e) {
      setDecision(null)
      setErr(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [enabled, mint])

  useEffect(() => {
    void load()
  }, [load])

  if (!enabled) return null

  const actionColor =
    decision?.action === 'BUY' ? '#00ff88' : decision?.action === 'WAIT' ? '#d4af37' : '#ff4444'

  return (
    <div
      style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 10,
        border: '1px solid rgba(212,175,55,0.2)',
        background: 'linear-gradient(145deg, #0a0a0a 0%, #111 100%)',
        fontFamily: "'IBM Plex Mono',monospace",
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#6e7681' }}>AI COPILOT</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3', marginTop: 4 }}>What should I do now?</div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{
            fontSize: 10,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid rgba(212,175,55,0.35)',
            background: 'rgba(212,175,55,0.08)',
            color: '#d4af37',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {err && (
        <div style={{ color: '#ff6b6b', fontSize: 11, marginBottom: 10 }}>{err}</div>
      )}

      {!decision && !err && !loading && (
        <div style={{ color: '#8b949e', fontSize: 11 }}>Select a mint with live intel to compute a decision.</div>
      )}

      {decision && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: actionColor }}>{decision.action}</span>
            <span style={{ fontSize: 12, color: '#8b949e' }}>confidence {Math.round(decision.confidence)}%</span>
          </div>
          <div style={{ fontSize: 11, color: '#c9d1d9', lineHeight: 1.6 }}>{decision.reasoning}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 10, color: '#6e7681' }}>
            <span>
              entry band (score){' '}
              <span style={{ color: '#d4af37' }}>
                {decision.entry_range[0]}–{decision.entry_range[1]}
              </span>
            </span>
            <span>
              exit window <span style={{ color: '#d4af37' }}>{decision.exit_window}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
