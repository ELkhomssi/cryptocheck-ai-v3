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
        <div className="tos-stack-sm">
          {rows.map((o) => (
            <article key={o.id} className="tos-card-tile">
              <div className="tos-row-between">
                <strong>
                  ${o.symbol} <span className="tos-secondary">{o.name}</span>
                </strong>
                <span className="tos-num" style={{ color: 'var(--tos-accent-gold)' }}>
                  Opp {o.opportunityScore}
                </span>
              </div>
              <div className="tos-card-tile-meta">
                {o.narrative} · Risk {o.risk} · {o.timeHorizon}
              </div>
              <p className="tos-card-tile-meta" style={{ color: 'var(--tos-text-secondary)' }}>
                Catalyst: {o.catalyst}. Why: {o.why} (conf {o.confidence}%)
              </p>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
