'use client'

import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { Sparkline } from '@/features/terminal-os/shared/components/Sparkline'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { useTopTokens } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { ChainId } from '@/features/terminal-os/shared/types'

const TABS: { id: ChainId; label: string }[] = [
  { id: 'all', label: 'All Chains' },
  { id: 'solana', label: 'Solana' },
  { id: 'bnb', label: 'BNB' },
  { id: 'base', label: 'Base' },
  { id: 'ethereum', label: 'Trending' },
]

export function TopTokensToday() {
  const tab = useTerminalOsStore((s) => s.tokenChainTab)
  const setTab = useTerminalOsStore((s) => s.setTokenChainTab)
  const { data: rows, isLoading, isError, error } = useTopTokens(tab)

  return (
    <Panel
      title="Top Tokens Today"
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
        <EmptyState message={error instanceof Error ? error.message : 'Token feed offline'} />
      ) : isLoading || !rows ? (
        <PanelSkeleton rows={2} />
      ) : rows.length === 0 ? (
        <EmptyState message="No tokens for this chain filter." />
      ) : (
        <div className="tos-scroll-x">
          {rows.map((t, idx) => (
            <article key={t.id} className="tos-metric-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.35rem',
                  marginBottom: '0.35rem',
                }}
              >
                <strong style={{ fontSize: 'var(--tos-fs-md)' }}>
                  #{idx + 1} ${t.symbol}
                </strong>
                <span className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)' }}>
                  {t.chain}
                </span>
              </div>
              <div className="tos-num" style={{ fontSize: 'var(--tos-fs-lg)', fontWeight: 700 }}>
                {formatUsd(t.priceUsd)}
              </div>
              <div style={{ margin: '0.25rem 0' }}>
                <Pct value={t.change24hPct} />
              </div>
              <Sparkline values={t.sparkline} positive={t.change24hPct >= 0} width={96} height={28} />
              <div
                className="tos-muted tos-num"
                style={{ fontSize: 'var(--tos-fs-xs)', marginTop: '0.4rem', lineHeight: 1.4 }}
              >
                Vol {formatUsd(t.volume24hUsd, true)}
                <br />
                Liq {formatUsd(t.liquidityUsd, true)} · MCap {formatUsd(t.marketCapUsd, true)}
                <br />
                Tx {t.txCount24h.toLocaleString()} · B/S {t.buySellRatio.toFixed(2)}
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
