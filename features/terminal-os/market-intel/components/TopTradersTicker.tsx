'use client'

import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { formatPct, formatUsd } from '@/features/terminal-os/shared/lib/format'
import { useTopTraders } from '@/features/terminal-os/shared/hooks/useTerminalQueries'

export function TopTradersTicker() {
  const { data: traders, isLoading, isError, error } = useTopTraders()

  return (
    <Panel title="Top Traders Today" live>
      {isError ? (
        <EmptyState message={error instanceof Error ? error.message : 'Traders feed offline'} />
      ) : isLoading || !traders ? (
        <PanelSkeleton rows={2} />
      ) : traders.length === 0 ? (
        <EmptyState message="No ranked traders yet." />
      ) : (
        <div className="tos-scroll-x">
          {traders.map((t, idx) => (
            <article key={t.id} className="tos-metric-card">
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '0.5rem',
                    background: 'var(--tos-accent-gold-dim)',
                    color: 'var(--tos-accent-gold)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 'var(--tos-fs-xs)',
                    flexShrink: 0,
                    backgroundImage: t.logoUrl ? `url(${t.logoUrl})` : undefined,
                    backgroundSize: 'cover',
                  }}
                >
                  {!t.logoUrl ? t.avatarInitials : null}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 'var(--tos-fs-md)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    #{idx + 1} {t.handle}
                  </div>
                  <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)' }}>
                    WR {t.winRatePct}% · {t.activePositions} pos
                  </div>
                </div>
              </div>
              <div className={`tos-num ${t.pnlPct >= 0 ? 'tos-pos' : 'tos-neg'}`} style={{ fontSize: 'var(--tos-fs-xl)', fontWeight: 800 }}>
                {formatPct(t.pnlPct)}
              </div>
              <div className="tos-num tos-secondary" style={{ fontSize: 'var(--tos-fs-sm)' }}>
                {formatUsd(t.pnlUsd, true)} PNL
              </div>
              <div className="tos-muted tos-num" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: '0.35rem' }}>
                Vol {formatUsd(t.volume24hUsd ?? 0, true)} · Conf {t.aiConfidence}%
              </div>
              <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: '0.25rem', lineHeight: 1.35 }}>
                {t.confidenceWhy}
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
