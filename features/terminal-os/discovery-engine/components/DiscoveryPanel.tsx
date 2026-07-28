'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { mockDiscoveryProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import type { DiscoveryOpportunity } from '@/features/terminal-os/shared/types'

export function DiscoveryPanel() {
  const [rows, setRows] = useState<DiscoveryOpportunity[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    mockDiscoveryProvider
      .getOpportunities()
      .then((r) => {
        if (!c) setRows(r)
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
    return () => {
      c = true
    }
  }, [])

  return (
    <Panel title="Discovery Engine" live>
      {error ? (
        <EmptyState message={error} />
      ) : !rows ? (
        <PanelSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState message="No opportunities scored yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((o) => (
            <article
              key={o.id}
              style={{
                border: '1px solid var(--tos-border-subtle)',
                borderRadius: 10,
                padding: 10,
                background: 'var(--tos-bg-panel)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>
                  ${o.symbol} <span className="tos-secondary">{o.name}</span>
                </strong>
                <span className="tos-num" style={{ color: 'var(--tos-accent-gold)' }}>
                  Opp {o.opportunityScore}
                </span>
              </div>
              <div className="tos-muted" style={{ fontSize: 11, marginTop: 4 }}>
                {o.narrative} · Risk {o.risk} · {o.timeHorizon}
              </div>
              <p style={{ fontSize: 11, marginTop: 6, color: 'var(--tos-text-secondary)', lineHeight: 1.4 }}>
                Catalyst: {o.catalyst}. Why: {o.why} (conf {o.confidence}%)
              </p>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
