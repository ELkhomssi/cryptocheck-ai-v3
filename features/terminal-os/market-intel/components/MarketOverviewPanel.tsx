'use client'

import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { CandlestickChart } from '@/features/terminal-os/trading-workspace/components/CandlestickChart'
import { formatPct, formatUsd } from '@/features/terminal-os/shared/lib/format'
import { useChainSnapshots, useMarketOverview } from '@/features/terminal-os/shared/hooks/useTerminalQueries'

export function MarketOverviewPanel() {
  const { data: overview, isLoading, isError, error } = useMarketOverview()
  const { data: snaps } = useChainSnapshots()
  const candles = snaps?.find((s) => s.chain === 'all')?.candles ?? []

  return (
    <Panel title="Market Overview" live>
      {isError ? (
        <EmptyState message={error instanceof Error ? error.message : 'Overview offline'} />
      ) : isLoading || !overview ? (
        <PanelSkeleton rows={3} />
      ) : (
        <div className="tos-chart-split">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
            }}
          >
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
          <div>
            <CandlestickChart candles={candles} height={160} />
            <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: '0.35rem' }}>
              BTC proxy chart · updated {new Date(overview.fetchedAt).toLocaleTimeString()}
            </div>
          </div>
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
    <div className="tos-metric-card" style={{ padding: '0.5rem 0.65rem' }}>
      <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginBottom: '0.2rem' }}>
        {label}
      </div>
      <div
        className={`tos-num ${tone === 'pos' ? 'tos-pos' : tone === 'neg' ? 'tos-neg' : ''}`}
        style={{ fontSize: 'var(--tos-fs-md)', fontWeight: 800 }}
      >
        {value}
      </div>
    </div>
  )
}
