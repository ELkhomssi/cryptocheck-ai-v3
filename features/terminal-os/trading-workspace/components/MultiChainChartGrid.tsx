'use client'

import dynamic from 'next/dynamic'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import {
  useChainSnapshots,
  useMarketOverview,
} from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import type { ChainId, ChainMarketSnapshot, MarketOverview } from '@/features/terminal-os/shared/types'

/** Lazy-load Lightweight Charts — home route paints without chart JS until grid mounts */
const CandlestickChart = dynamic(
  () => import('./CandlestickChart').then((m) => m.CandlestickChart),
  {
    ssr: false,
    loading: () => <div className="tos-skeleton" style={{ height: 148, width: '100%' }} aria-label="Chart loading" />,
  },
)

const QUADS: { chain: ChainId; label: string }[] = [
  { chain: 'solana', label: 'Solana' },
  { chain: 'bnb', label: 'BNB Chain' },
  { chain: 'base', label: 'Base' },
  { chain: 'all', label: 'Market Overview' },
]

/** Mockup 2×2: each quadrant = leaderboard (~35%) + professional candle chart (~65%) */
export function MultiChainChartGrid() {
  const { data: snaps, isLoading, isError, error } = useChainSnapshots()
  const { data: overview } = useMarketOverview()

  return (
    <Panel title="Multi-Chain Charts" live>
      {isError ? (
        <EmptyState message={error instanceof Error ? error.message : 'Charts offline'} />
      ) : isLoading || !snaps ? (
        <PanelSkeleton rows={8} />
      ) : (
        <div className="tos-quad-grid">
          {QUADS.map((q) => {
            const snap = snaps.find((s) => s.chain === q.chain)
            return (
              <Quadrant
                key={q.chain}
                label={q.label}
                snap={snap}
                overview={q.chain === 'all' ? overview ?? null : null}
              />
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function Quadrant({
  label,
  snap,
  overview,
}: {
  label: string
  snap?: ChainMarketSnapshot
  overview: MarketOverview | null
}) {
  return (
    <div className="tos-quad">
      <div className="tos-quad-head">
        <span>Top {label}</span>
        <span className="tos-live">
          <span className="tos-live-dot" aria-hidden />
          LIVE
        </span>
      </div>
      {overview ? (
        <div className="tos-overview-metrics">
          <Metric label="Market Cap" value={formatUsd(overview.marketCapUsd, true)} />
          <Metric label="Volume 24h" value={formatUsd(overview.volume24hUsd, true)} />
          <Metric label="BTC Dom" value={`${overview.btcDominancePct.toFixed(2)}%`} />
          <Metric label="Alt Index" value={`${overview.altcoinIndex}/100`} />
        </div>
      ) : null}
      <div className="tos-chart-split">
        <ul className="tos-leaderboard">
          {(snap?.topTokens ?? []).slice(0, 5).map((t) => (
            <li key={t.id}>
              <span className="tos-lb-sym">
                {t.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logoUrl} alt="" width={16} height={16} />
                ) : (
                  <span className="tos-lb-dot" />
                )}
                ${t.symbol}
              </span>
              <Pct value={t.change24hPct} />
              <span className="tos-num tos-secondary">{formatUsd(t.priceUsd)}</span>
            </li>
          ))}
          {!snap?.topTokens?.length ? <li className="tos-muted">No leaders</li> : null}
        </ul>
        <CandlestickChart candles={snap?.candles ?? []} height={148} />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)' }}>
        {label}
      </div>
      <div className="tos-num" style={{ fontWeight: 800, fontSize: 'var(--tos-fs-sm)' }}>
        {value}
      </div>
    </div>
  )
}
