'use client'

import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton, StaleIndicator } from '@/features/terminal-os/shared/components/PanelStates'
import { Sparkline } from '@/features/terminal-os/shared/components/Sparkline'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { AnimatedNumber } from '@/features/terminal-os/shared/components/AnimatedNumber'
import { useTopTokens } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { ChainId } from '@/features/terminal-os/shared/types'

const TABS: { id: ChainId; label: string }[] = [
  { id: 'all', label: 'All Chains' },
  { id: 'solana', label: 'Solana' },
  { id: 'bnb', label: 'BNB Chain' },
  { id: 'base', label: 'Base' },
  { id: 'ethereum', label: 'Trending' },
]

export function TopTokensToday() {
  const tab = useTerminalOsStore((s) => s.tokenChainTab)
  const setTab = useTerminalOsStore((s) => s.setTokenChainTab)
  const { data: rows, isLoading, isError, isFetching } = useTopTokens(tab)

  return (
    <Panel
      title="Top Tokens Today"
      live
      action={
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {(isError || (isFetching && !rows?.length)) && (
            <StaleIndicator stale demo={isError} ageSec={0} source="dexscreener" />
          )}
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
      {isLoading && !rows ? (
        <PanelSkeleton rows={2} />
      ) : !rows || rows.length === 0 ? (
        isError ? (
          <div>
            <StaleIndicator stale demo source="dexscreener" />
            <PanelSkeleton rows={2} />
          </div>
        ) : (
          <EmptyState message="No tokens for this chain filter." />
        )
      ) : (
        <div className="tos-scroll-x">
          {rows.map((t, idx) => (
            <article key={t.id} className="tos-token-card">
              <div className="tos-token-head">
                <span className="tos-token-icon" aria-hidden>
                  {t.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logoUrl} alt="" />
                  ) : (
                    <span>${t.symbol.slice(0, 1)}</span>
                  )}
                </span>
                <div>
                  <div className="tos-token-sym">
                    #{idx + 1} ${t.symbol}
                  </div>
                  <div className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)' }}>
                    {t.chain}
                  </div>
                </div>
              </div>
              <div className="tos-num tos-token-price">
                <AnimatedNumber value={t.priceUsd} format={(n) => formatUsd(n)} />
              </div>
              <Pct value={t.change24hPct} />
              <div className="tos-token-spark">
                <Sparkline values={t.sparkline} positive={t.change24hPct >= 0} width={110} height={36} />
              </div>
              <div className="tos-token-meta tos-num">
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
