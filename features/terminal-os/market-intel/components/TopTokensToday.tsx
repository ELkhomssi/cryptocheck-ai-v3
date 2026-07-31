'use client'

import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton, StaleIndicator } from '@/features/terminal-os/shared/components/PanelStates'
import { DensityRibbon } from '@/features/terminal-os/shared/components/DensityRibbon'
import { Sparkline } from '@/features/terminal-os/shared/components/Sparkline'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { AnimatedNumber } from '@/features/terminal-os/shared/components/AnimatedNumber'
import { useTopTokens } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { createPriceAlertFromToken } from '@/features/terminal-os/alerts/create-price-alert'
import type { ChainId, TokenRow } from '@/features/terminal-os/shared/types'

const TABS: { id: ChainId; label: string }[] = [
  { id: 'all', label: 'All Chains' },
  { id: 'solana', label: 'Solana' },
  { id: 'bnb', label: 'BNB Chain' },
  { id: 'base', label: 'Base' },
  { id: 'ethereum', label: 'Trending' },
]

const CHAIN_ICON: Record<string, string> = {
  solana: '◎',
  bnb: 'B',
  ethereum: 'Ξ',
  base: 'B',
  arbitrum: 'A',
  all: '✦',
}

export function TopTokensToday() {
  const tab = useTerminalOsStore((s) => s.tokenChainTab)
  const setTab = useTerminalOsStore((s) => s.setTokenChainTab)
  const setFocusedToken = useTerminalOsStore((s) => s.setFocusedToken)
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
        <div className="tos-ribbon-skeleton tos-ribbon-skeleton--tokens" aria-hidden>
          <PanelSkeleton rows={1} />
        </div>
      ) : !rows || rows.length === 0 ? (
        isError ? (
          <div>
            <StaleIndicator stale demo source="dexscreener" />
            <PanelSkeleton rows={1} />
          </div>
        ) : (
          <EmptyState message="No tokens for this chain filter." />
        )
      ) : (
        <DensityRibbon
          items={rows}
          ariaLabel="Top tokens today, scrolling ribbon"
          className="tos-tokens-ribbon"
          itemClassName="tos-token-chip"
          itemKey={(t) => t.id}
          renderItem={(t) => <TokenChip token={t} />}
          onItemActivate={(t) =>
            setFocusedToken({
              id: t.id,
              symbol: t.symbol,
              name: t.name,
              chain: t.chain,
              priceUsd: t.priceUsd,
              logoUrl: t.logoUrl,
            })
          }
        />
      )}
    </Panel>
  )
}

function TokenChip({ token: t }: { token: TokenRow }) {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const [notifyBusy, setNotifyBusy] = useState(false)

  const onNotify = async (e: MouseEvent) => {
    e.stopPropagation()
    if (!wallet) return
    setNotifyBusy(true)
    try {
      // Threshold slightly above current price so it can fire when price moves
      const threshold = Number((t.priceUsd * 1.02).toFixed(8))
      await createPriceAlertFromToken({
        wallet,
        token: { id: t.id, symbol: t.symbol, chain: t.chain },
        thresholdUsd: threshold,
      })
    } finally {
      setNotifyBusy(false)
    }
  }

  return (
    <>
      <span className="tos-token-chip-logo" aria-hidden>
        {t.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logoUrl} alt="" />
        ) : (
          <span>{t.symbol.slice(0, 1)}</span>
        )}
      </span>
      <span className="tos-token-chip-sym">${t.symbol}</span>
      <span className="tos-num tos-token-chip-price">
        <AnimatedNumber value={t.priceUsd} format={(n) => formatUsd(n)} />
      </span>
      <span className="tos-token-chip-pct">
        <Pct value={t.change24hPct} />
      </span>
      <span className="tos-num tos-token-chip-liq">Liq {formatUsd(t.liquidityUsd, true)}</span>
      <span className="tos-num tos-token-chip-vol">Vol {formatUsd(t.volume24hUsd, true)}</span>
      <span className="tos-token-chip-chain" title={t.chain} aria-label={t.chain}>
        {CHAIN_ICON[t.chain] ?? t.chain.slice(0, 1).toUpperCase()}
      </span>
      <span className="tos-token-chip-spark">
        <Sparkline values={t.sparkline} positive={t.change24hPct >= 0} width={40} height={18} />
      </span>
      {wallet ? (
        <button
          type="button"
          className="tos-btn tos-btn-ghost"
          style={{ fontSize: 'var(--tos-fs-xs)', padding: '2px 6px', marginLeft: 4 }}
          disabled={notifyBusy}
          title={`Notify when ${t.symbol} rises ~2%`}
          onClick={(e) => void onNotify(e)}
        >
          Notify
        </button>
      ) : null}
    </>
  )
}
