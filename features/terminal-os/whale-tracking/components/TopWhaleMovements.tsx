'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { formatUsd, timeAgo } from '@/features/terminal-os/shared/lib/format'
import { mockWhaleFeedProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import type { WhaleMovement } from '@/features/terminal-os/shared/types'

const ACTION_COLOR: Record<WhaleMovement['action'], string> = {
  buy: 'var(--tos-positive)',
  deposit: 'var(--tos-positive)',
  sell: 'var(--tos-negative)',
  withdraw: 'var(--tos-warning)',
  swap: 'var(--tos-accent-blue)',
}

export function TopWhaleMovements() {
  const [rows, setRows] = useState<WhaleMovement[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    mockWhaleFeedProvider
      .getRecentMovements()
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
    <Panel title="Top Whale Movements" live>
      {error ? (
        <EmptyState message={error} />
      ) : !rows ? (
        <PanelSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState message="Waiting for whale flow…" />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((w, i) => (
            <li
              key={w.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 10,
                alignItems: 'center',
                fontSize: 12,
                padding: '8px 0',
                borderBottom:
                  i === rows.length - 1 ? 'none' : '1px solid var(--tos-border-subtle)',
              }}
            >
              <span className="tos-mono tos-secondary">Whale #{i + 1}</span>
              <div>
                <div>
                  <span className="tos-mono">{w.walletTruncated}</span>{' '}
                  <span style={{ color: ACTION_COLOR[w.action], fontWeight: 700 }}>
                    {w.action.toUpperCase()}
                  </span>{' '}
                  <strong>${w.assetSymbol}</strong>{' '}
                  <span className="tos-num">{formatUsd(w.usdValue, true)}</span>
                </div>
                <div className="tos-muted" style={{ fontSize: 10, marginTop: 2 }}>
                  {w.classification} — {w.classificationWhy}
                </div>
              </div>
              <span className="tos-muted tos-num" style={{ fontSize: 11 }}>
                {timeAgo(w.occurredAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
