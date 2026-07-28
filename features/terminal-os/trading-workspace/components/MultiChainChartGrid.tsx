'use client'

import { useMemo, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { CandlestickChart } from './CandlestickChart'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { useChainSnapshots } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import type { ChainId } from '@/features/terminal-os/shared/types'

const TABS: { id: ChainId; label: string }[] = [
  { id: 'solana', label: 'Solana' },
  { id: 'bnb', label: 'BNB Chain' },
  { id: 'base', label: 'Base' },
  { id: 'all', label: 'All Market' },
]

export function MultiChainChartGrid() {
  const { data: snaps, isLoading, isError, error } = useChainSnapshots()
  const [tab, setTab] = useState<ChainId>('solana')

  const active = useMemo(() => snaps?.find((s) => s.chain === tab) ?? snaps?.[0], [snaps, tab])

  return (
    <Panel
      title="Multi-Chain Charts"
      live
      action={
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="tos-tab"
              data-active={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {isError ? (
        <EmptyState message={error instanceof Error ? error.message : 'Charts offline'} />
      ) : isLoading || !active ? (
        <PanelSkeleton rows={5} />
      ) : (
        <div className="tos-chart-split">
          <div>
            <div
              style={{
                fontSize: 'var(--tos-fs-sm)',
                fontWeight: 700,
                marginBottom: '0.5rem',
              }}
            >
              Top {active.label}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 'var(--tos-fs-sm)' }}>
              {active.topTokens.length === 0 ? (
                <li className="tos-muted">No leaders</li>
              ) : (
                active.topTokens.map((t) => (
                  <li
                    key={t.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap: '0.4rem',
                      padding: '0.4rem 0',
                      borderBottom: '1px solid var(--tos-border-subtle)',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      <strong>${t.symbol}</strong>
                      <span className="tos-muted" style={{ display: 'block', fontSize: 'var(--tos-fs-xs)' }}>
                        Vol {formatUsd(t.volume24hUsd, true)} · Liq {formatUsd(t.liquidityUsd, true)}
                      </span>
                    </span>
                    <Pct value={t.change24hPct} />
                    <span className="tos-num tos-secondary">{formatUsd(t.priceUsd)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <CandlestickChart candles={active.candles} height={200} />
            <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: '0.35rem' }}>
              Live CoinGecko OHLC · leaderboard DexScreener
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}
