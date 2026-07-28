'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import { mockPortfolioOsProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import type { PortfolioHealthSummary } from '@/features/terminal-os/shared/types'

export function PortfolioOverviewPanel() {
  const [data, setData] = useState<PortfolioHealthSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    mockPortfolioOsProvider
      .getHealthSummary()
      .then((d) => {
        if (!c) setData(d)
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
    return () => {
      c = true
    }
  }, [])

  return (
    <Panel title="Market Overview · Portfolio Health">
      {error ? (
        <EmptyState message={error} />
      ) : !data ? (
        <PanelSkeleton rows={3} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
          }}
        >
          <Metric label="Total assets" value={formatUsd(data.totalAssetsUsd, true)} />
          <Metric
            label="24h PNL"
            value={
              <>
                {formatUsd(data.pnl24hUsd, true)} <Pct value={data.pnl24hPct} />
              </>
            }
          />
          <Metric
            label="AI Health"
            value={`${data.aiHealthScore}`}
            why={data.healthWhy}
          />
          <Metric
            label="Stability"
            value={`${data.stabilityScore}`}
            why={data.stabilityWhy}
          />
          <Metric label="Diversification" value={`${data.diversificationScore}`} />
        </div>
      )}
    </Panel>
  )
}

function Metric({
  label,
  value,
  why,
}: {
  label: string
  value: ReactNode
  why?: string
}) {
  return (
    <div>
      <div className="tos-muted" style={{ fontSize: 10, marginBottom: 4 }}>
        {label}
      </div>
      <div className="tos-num" style={{ fontSize: 18, fontWeight: 800 }}>
        {value}
      </div>
      {why ? (
        <div className="tos-muted" style={{ fontSize: 10, marginTop: 4, lineHeight: 1.35 }}>
          Why: {why}
        </div>
      ) : null}
    </div>
  )
}
