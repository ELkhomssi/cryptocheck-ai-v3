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
        <div className="tos-scroll-x tos-traders-row">
          {traders.map((t, idx) => (
            <article key={t.id} className="tos-trader-card">
              <div className="tos-trader-rank">#{idx + 1}</div>
              <div className="tos-trader-avatar" aria-hidden>
                {t.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logoUrl} alt="" />
                ) : (
                  t.avatarInitials
                )}
              </div>
              <div className="tos-trader-name">{t.handle}</div>
              <div className={`tos-num tos-trader-pnl ${t.pnlPct >= 0 ? 'tos-pos' : 'tos-neg'}`}>
                {formatPct(t.pnlPct)}
              </div>
              <div className="tos-num tos-trader-usd">{formatUsd(t.pnlUsd, true)} PNL</div>
              <div className="tos-trader-meta">
                <span>WR {t.winRatePct}%</span>
                <span>{t.activePositions} pos</span>
              </div>
              <div className="tos-trader-meta tos-muted">
                <span>{t.underlyingSymbol ?? '—'}</span>
                <span>Conf {t.aiConfidence}%</span>
              </div>
              <div className="tos-trader-meta tos-muted tos-num">
                Vol {formatUsd(t.volume24hUsd ?? 0, true)}
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
