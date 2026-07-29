'use client'

import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton, StaleIndicator } from '@/features/terminal-os/shared/components/PanelStates'
import { DensityRibbon } from '@/features/terminal-os/shared/components/DensityRibbon'
import { formatPct } from '@/features/terminal-os/shared/lib/format'
import { useTopTraders } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import type { TopTrader } from '@/features/terminal-os/shared/types'

/**
 * FLAG (refinement pass): No Trader Profile view/click handler exists in Terminal OS.
 * Items are tab-focusable and pause the ribbon; activate is intentionally unwired
 * until an existing profile route/handler is available to reuse.
 */
export function TopTradersTicker() {
  const { data: traders, isLoading, isError } = useTopTraders()

  return (
    <Panel title="Top Traders Today" live>
      {isError && !traders?.length ? (
        <div>
          <StaleIndicator stale demo source="coingecko" />
          <PanelSkeleton rows={1} />
        </div>
      ) : isLoading || !traders ? (
        <div className="tos-ribbon-skeleton tos-ribbon-skeleton--traders" aria-hidden>
          <PanelSkeleton rows={1} />
        </div>
      ) : traders.length === 0 ? (
        <EmptyState message="No ranked traders yet." />
      ) : (
        <DensityRibbon
          items={traders}
          ariaLabel="Top traders today, scrolling ribbon"
          className="tos-traders-ribbon"
          itemClassName="tos-trader-chip"
          itemKey={(t) => t.id}
          renderItem={(t) => <TraderChip trader={t} />}
        />
      )}
    </Panel>
  )
}

function TraderChip({ trader: t }: { trader: TopTrader }) {
  const active = t.activePositions > 0
  return (
    <>
      <span className="tos-trader-chip-avatar" aria-hidden>
        {t.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logoUrl} alt="" />
        ) : (
          t.avatarInitials
        )}
      </span>
      <span className="tos-trader-chip-name">{t.handle}</span>
      <span className={`tos-num tos-trader-chip-pnl ${t.pnlPct >= 0 ? 'tos-pos' : 'tos-neg'}`}>
        {formatPct(t.pnlPct)}
      </span>
      <span className="tos-num tos-trader-chip-wr">WR {t.winRatePct}%</span>
      <span className="tos-trader-chip-conf" title={t.confidenceWhy}>
        {t.aiConfidence}%
      </span>
      <span
        className={`tos-trader-chip-dot${active ? ' is-active' : ''}`}
        title={active ? `${t.activePositions} active positions` : 'No active positions'}
        aria-label={active ? `${t.activePositions} active positions` : 'No active positions'}
      />
    </>
  )
}
