'use client'

import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { IntelligenceChart } from '@/features/intelligence-chart'
import { formatPct, formatUsd } from '@/features/terminal-os/shared/lib/format'
import { useMarketOverview } from '@/features/terminal-os/shared/hooks/useTerminalQueries'

export function MarketOverviewPanel() {
  const { data, isLoading, isError, error } = useMarketOverview()
  const overview = data?.item

  return (
    <Panel title="Market Overview" live={!data?.meta.demo}>
      {isError ? (
        <EmptyState message={error instanceof Error ? error.message : 'Overview offline'} />
      ) : isLoading || !overview ? (
        <PanelSkeleton rows={3} />
      ) : (
        <div className="tos-stack">
          <div className="tos-stat-grid">
            <Stat label="Market Cap" value={formatUsd(overview.marketCapUsd, true)} />
            <Stat label="Volume 24h" value={formatUsd(overview.volume24hUsd, true)} />
            <Stat label="BTC Dominance" value={`${overview.btcDominancePct.toFixed(2)}%`} />
            <Stat label="Altcoin Index" value={`${overview.altcoinIndex}/100`} />
            <Stat
              label="MCap 24h"
              value={formatPct(overview.marketCapChange24hPct)}
              tone={overview.marketCapChange24hPct >= 0 ? 'pos' : 'neg'}
            />
            <Stat label="Source" value={overview.source} />
          </div>
          <IntelligenceChart query="BTC" chain="all" />
        </div>
      )}
    </Panel>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'pos' | 'neg'
}) {
  return (
    <div className="tos-metric-card">
      <div className="tos-metric-label">{label}</div>
      <div
        className={`tos-num tos-stat-value ${tone === 'pos' ? 'tos-pos' : tone === 'neg' ? 'tos-neg' : ''}`}
      >
        {value}
      </div>
    </div>
  )
}
