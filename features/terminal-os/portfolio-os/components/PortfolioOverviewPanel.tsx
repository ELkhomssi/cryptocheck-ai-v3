'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import type { PortfolioHealthSummary } from '@/features/terminal-os/shared/types'

function summaryFromHoldings(h: HoldingsResponse): PortfolioHealthSummary {
  const n = h.holdings.length
  const topShare = n ? Math.max(...h.holdings.map((x) => x.allocationPct)) : 0
  const diversificationScore = Math.max(5, Math.min(95, Math.round(100 - topShare * 0.7 + Math.min(n, 12) * 2)))
  const avgAbsChg =
    n > 0
      ? h.holdings.reduce((s, x) => s + Math.abs(x.change24hPct ?? 0), 0) / n
      : 0
  const pnl24hPct =
    h.totalValueUsd > 0
      ? h.holdings.reduce((s, x) => s + ((x.change24hPct ?? 0) * x.valueUsd) / h.totalValueUsd, 0)
      : 0
  const pnl24hUsd = (pnl24hPct / 100) * h.totalValueUsd
  const stabilityScore = Math.max(5, Math.min(95, Math.round(80 - avgAbsChg)))
  const aiHealthScore = Math.round((diversificationScore + stabilityScore) / 2)

  return {
    totalAssetsUsd: h.totalValueUsd,
    pnl24hUsd,
    pnl24hPct,
    diversificationScore,
    aiHealthScore,
    stabilityScore,
    healthWhy:
      n === 0
        ? 'No token holdings detected for this wallet yet.'
        : `Derived from ${n} live holdings via portfolio holdings API.`,
    stabilityWhy:
      avgAbsChg > 12
        ? '24h price swings are elevated across holdings.'
        : 'Holdings show moderate 24h movement vs peers.',
  }
}

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
