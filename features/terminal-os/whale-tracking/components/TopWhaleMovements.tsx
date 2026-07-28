'use client'

import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { formatUsd, timeAgo } from '@/features/terminal-os/shared/lib/format'
import { useWhaleMovements } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import type { WhaleMovement } from '@/features/terminal-os/shared/types'

const ACTION_COLOR: Record<WhaleMovement['action'], string> = {
  buy: 'var(--tos-positive)',
  deposit: 'var(--tos-positive)',
  sell: 'var(--tos-negative)',
  withdraw: 'var(--tos-warning)',
  swap: 'var(--tos-accent-blue)',
}

export function TopWhaleMovements() {
  const { data: rows, isLoading, isError, error } = useWhaleMovements(10)

  return (
    <Panel title="Top Whale Movements" live>
      {isError ? (
        <EmptyState message={error instanceof Error ? error.message : 'Whale feed offline'} />
      ) : isLoading || !rows ? (
        <PanelSkeleton rows={2} />
      ) : rows.length === 0 ? (
        <EmptyState message="Waiting for whale flow…" />
      ) : (
        <div className="tos-scroll-x">
          {rows.map((w, i) => (
            <article key={w.id} className="tos-metric-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.35rem',
                  marginBottom: '0.35rem',
                }}
              >
                <span className="tos-mono tos-secondary" style={{ fontSize: 'var(--tos-fs-sm)' }}>
                  Whale #{i + 1}
                </span>
                <span className="tos-muted tos-num" style={{ fontSize: 'var(--tos-fs-xs)' }}>
                  {timeAgo(w.occurredAt)}
                </span>
              </div>
              <div className="tos-mono" style={{ fontSize: 'var(--tos-fs-md)', fontWeight: 700 }}>
                {w.walletTruncated}
              </div>
              <div style={{ marginTop: '0.35rem', fontSize: 'var(--tos-fs-sm)' }}>
                <span style={{ color: ACTION_COLOR[w.action], fontWeight: 700 }}>
                  {w.action.toUpperCase()}
                </span>{' '}
                <strong>${w.assetSymbol}</strong>
              </div>
              <div className="tos-num" style={{ fontSize: 'var(--tos-fs-lg)', fontWeight: 800, marginTop: '0.25rem' }}>
                {formatUsd(w.usdValue, true)}
              </div>
              <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: '0.35rem' }}>
                {w.chain} · amt {w.amount.toLocaleString()}
              </div>
              <div
                style={{
                  marginTop: '0.4rem',
                  fontSize: 'var(--tos-fs-xs)',
                  fontWeight: 700,
                  color: 'var(--tos-accent-gold)',
                }}
              >
                {w.classification}
              </div>
              <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', lineHeight: 1.35, marginTop: '0.2rem' }}>
                {w.classificationWhy}
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
