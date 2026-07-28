'use client'

import { Waves } from 'lucide-react'
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
  swap: 'var(--tos-accent-purple)',
}

export function TopWhaleMovements() {
  const { data: rows, isLoading, isError, error } = useWhaleMovements(8)

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
            <article key={w.id} className="tos-whale-card">
              <div className="tos-whale-top">
                <span className="tos-whale-icon" aria-hidden>
                  <Waves size={14} />
                </span>
                <span className="tos-muted tos-num" style={{ fontSize: 'var(--tos-fs-xs)' }}>
                  {timeAgo(w.occurredAt)}
                </span>
              </div>
              <div className="tos-whale-title">
                Whale #{i + 1} <span className="tos-mono">{w.walletTruncated}</span>
              </div>
              <div className="tos-whale-action">
                <span style={{ color: ACTION_COLOR[w.action], fontWeight: 800 }}>
                  {w.action.toUpperCase()}
                </span>{' '}
                <strong>${w.assetSymbol}</strong>
              </div>
              <div className="tos-num tos-whale-usd">{formatUsd(w.usdValue, true)}</div>
              <div className="tos-whale-meta">
                {w.chain} · amt {w.amount.toLocaleString()}
              </div>
              <div className="tos-whale-badge">{w.classification}</div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
