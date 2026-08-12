'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import type { PortfolioHealthSummary } from '@/features/terminal-os/shared/types'
import { summaryFromHoldings } from '@/features/terminal-os/portfolio-os/lib/summary-from-holdings'

export function PortfolioOverviewPanel() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const chainFamily = useTerminalOsStore((s) => s.walletChainFamily)
  const [data, setData] = useState<PortfolioHealthSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tokenCount, setTokenCount] = useState(0)

  useEffect(() => {
    let c = false
    setData(null)
    setError(null)

    if (!walletConnected || !wallet) {
      setError(null)
      setData(null)
      return
    }

    if (chainFamily === 'evm') {
      setError('Portfolio health uses Solana holdings today — connect a Solana wallet.')
      return
    }

    void fetch(`/api/portfolio/holdings?wallet=${encodeURIComponent(wallet)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || 'Holdings unavailable')
        }
        return (await res.json()) as HoldingsResponse
      })
      .then((h) => {
        if (c) return
        setTokenCount(h.holdings.length)
        setData(summaryFromHoldings(h))
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })

    return () => {
      c = true
    }
  }, [wallet, walletConnected, chainFamily])

  return (
    <Panel title="Market Overview · Portfolio Health">
      {!walletConnected ? (
        <EmptyState message="Connect a Solana wallet to load live portfolio health." />
      ) : error ? (
        <EmptyState message={error} />
      ) : !data ? (
        <PanelSkeleton rows={3} />
      ) : (
        <div className="tos-metric-grid">
          <Metric label="Total assets" value={formatUsd(data.totalAssetsUsd, true)} />
          <Metric
            label="24h PNL"
            value={
              <>
                {formatUsd(data.pnl24hUsd, true)} <Pct value={data.pnl24hPct} />
              </>
            }
          />
          <Metric label="AI Health" value={`${data.aiHealthScore}`} why={data.healthWhy} />
          <Metric label="Stability" value={`${data.stabilityScore}`} why={data.stabilityWhy} />
          <Metric
            label="Diversification"
            value={`${data.diversificationScore}`}
            why={tokenCount ? `${tokenCount} holdings` : undefined}
          />
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
      <div className="tos-metric-label">{label}</div>
      <div className="tos-metric-value">{value}</div>
      {why ? <div className="tos-metric-why">Why: {why}</div> : null}
    </div>
  )
}
