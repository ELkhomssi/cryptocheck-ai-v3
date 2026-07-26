'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import type { AgentRunStructured, RosterEmployeeView } from '@/types/agents'

export function AgentResultPanel({
  employee,
  result,
  loading,
  error,
  onClose,
  onRefresh,
}: {
  employee: RosterEmployeeView
  result: AgentRunStructured | null
  loading: boolean
  error: string | null
  onClose: () => void
  onRefresh: () => void
}) {
  const { walletAddress } = useSolana()
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<Record<string, 'accept' | 'dismiss'>>({})

  const sendFeedback = async (suggestionId: string, decision: 'accept' | 'dismiss', title: string) => {
    setFeedbackBusy(suggestionId)
    try {
      const res = await fetch('/api/agents/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: employee.id,
          suggestionId,
          decision,
          title,
          walletAddress: walletAddress ?? undefined,
        }),
      })
      if (res.ok) {
        setDecisions((d) => ({ ...d, [suggestionId]: decision }))
      }
    } finally {
      setFeedbackBusy(null)
    }
  }

  return (
    <div className="pd-panel" style={{ marginTop: 16 }}>
      <div className="pd-panel-head">
        <div>
          <h2>
            {employee.name} · {employee.actionLabel}
          </h2>
          <div style={{ fontSize: 11, color: 'var(--pd-text-faint)', marginTop: 2 }}>{employee.role}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="pd-tab" onClick={onRefresh} disabled={loading}>
            {loading ? 'Running…' : 'Refresh'}
          </button>
          <button type="button" className="pd-tab" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 18px 20px' }}>
        {loading && !result ? (
          <div>
            <div className="pd-skeleton" style={{ height: 18, width: '40%', marginBottom: 10 }} />
            <div className="pd-skeleton" style={{ height: 14, marginBottom: 8 }} />
            <div className="pd-skeleton" style={{ height: 14, width: '80%' }} />
          </div>
        ) : null}

        {error ? (
          <div style={{ color: 'var(--pd-negative)', fontSize: 13 }}>{error}</div>
        ) : null}

        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{result.title}</div>
              <div style={{ fontSize: 13, color: 'var(--pd-text-dim)', lineHeight: 1.5 }}>{result.summary}</div>
            </div>

            {result.stats?.length ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 8,
                }}
              >
                {result.stats.map((s) => (
                  <div key={s.label} className="pd-mcard" style={{ margin: 0, padding: '10px 12px' }}>
                    <div className="ml">{s.label}</div>
                    <div className="mv" style={{ fontSize: 14 }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {result.sections?.map((sec) => (
              <div key={sec.heading}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{sec.heading}</div>
                <div style={{ fontSize: 12.5, color: 'var(--pd-text-dim)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {sec.body}
                </div>
              </div>
            ))}

            {result.signals?.length ? (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Signals</div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {result.signals.map((sig, i) => (
                    <li
                      key={`${sig.mint || sig.symbol || i}-${i}`}
                      style={{
                        padding: '10px 0',
                        borderBottom: '1px solid var(--pd-border-soft)',
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong>{sig.symbol || sig.mint?.slice(0, 8) || 'Signal'}</strong>
                        {sig.severity ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontFamily: 'var(--font-ibm-plex-mono), monospace',
                              color: 'var(--pd-text-faint)',
                            }}
                          >
                            {sig.severity}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ color: 'var(--pd-text-dim)', marginTop: 4 }}>{sig.note}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.suggestions?.length ? (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Suggestions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.suggestions.map((sug) => {
                    const decided = decisions[sug.id]
                    return (
                      <div
                        key={sug.id}
                        style={{
                          border: '1px solid var(--pd-border)',
                          borderRadius: 6,
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{sug.title}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--pd-text-dim)', marginTop: 4, lineHeight: 1.45 }}>
                          {sug.detail}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          {decided ? (
                            <span style={{ fontSize: 11, color: 'var(--pd-text-faint)' }}>
                              {decided === 'accept' ? 'Accepted' : 'Dismissed'}
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="pd-connect"
                                style={{ padding: '6px 12px', fontSize: 12 }}
                                disabled={feedbackBusy === sug.id}
                                onClick={() => void sendFeedback(sug.id, 'accept', sug.title)}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="pd-tab"
                                disabled={feedbackBusy === sug.id}
                                onClick={() => void sendFeedback(sug.id, 'dismiss', sug.title)}
                              >
                                Dismiss
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div style={{ fontSize: 10.5, color: 'var(--pd-text-faint)' }}>{result.disclaimer}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
