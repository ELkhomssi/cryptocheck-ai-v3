'use client'

/**
 * Discovery — live market opportunities from Terminal OS feed (not mock rows).
 */

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { liveMarketDataProvider } from '@/features/terminal-os/shared/lib/live-providers'
import { scoreTokenFromMarket } from '@/features/terminal-os/shared/lib/score-from-market'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { DiscoveryOpportunity, RiskBand, TokenRow } from '@/features/terminal-os/shared/types'

function toOpportunity(t: TokenRow): DiscoveryOpportunity {
  const scan = scoreTokenFromMarket(t)
  const opportunityScore = Math.round(
    Math.min(98, Math.max(12, scan.score * 0.55 + Math.min(40, Math.log10(Math.max(t.volume24hUsd, 1)) * 8))),
  )
  const risk = (scan.band === 'excellent' || scan.band === 'good'
    ? 'low'
    : scan.band === 'caution'
      ? 'moderate'
      : 'high') as RiskBand
  return {
    id: t.id,
    symbol: t.symbol,
    name: t.name,
    opportunityScore,
    risk,
    narrative: `${t.chain} · liq ${Math.round(t.liquidityUsd).toLocaleString()}`,
    catalyst: t.change24hPct >= 0 ? 'Positive 24h momentum' : 'Pullback — watch for reclaim',
    confidence: scan.confidence,
    timeHorizon: 'intraday',
    why: scan.explanation,
  }
}

export function DiscoveryPanel() {
  const setFocusedToken = useTerminalOsStore((s) => s.setFocusedToken)
  const chain = useTerminalOsStore((s) => s.tokenChainTab)
  const [rows, setRows] = useState<DiscoveryOpportunity[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    liveMarketDataProvider
      .getTopTokens(chain === 'all' ? 'solana' : chain)
      .then((tokens) => {
        if (c) return
        setRows(tokens.slice(0, 8).map(toOpportunity))
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
    return () => {
      c = true
    }
  }, [chain])

  return (
    <Panel title="Discovery Engine" live>
      {error ? (
        <EmptyState message={error} />
      ) : !rows ? (
        <PanelSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState message="No live opportunities scored yet." />
      ) : (
        <div className="tos-stack-sm">
          {rows.map((o) => (
            <article
              key={o.id}
              className="tos-card-tile"
              role="button"
              tabIndex={0}
              onClick={() =>
                setFocusedToken({
                  id: o.id,
                  symbol: o.symbol,
                  name: o.name,
                  chain: chain === 'all' ? 'solana' : chain,
                  priceUsd: 0,
                  logoUrl: undefined,
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setFocusedToken({
                    id: o.id,
                    symbol: o.symbol,
                    name: o.name,
                    chain: chain === 'all' ? 'solana' : chain,
                    priceUsd: 0,
                    logoUrl: undefined,
                  })
                }
              }}
            >
              <div className="tos-row-between">
                <strong>
                  ${o.symbol} <span className="tos-secondary">{o.name}</span>
                </strong>
                <span className="tos-num" style={{ color: 'var(--tos-accent-gold)' }}>
                  Opp {o.opportunityScore}
                </span>
              </div>
              <div className="tos-card-tile-meta">
                {o.narrative} · Risk {o.risk} · {o.timeHorizon}
              </div>
              <p className="tos-card-tile-meta" style={{ color: 'var(--tos-text-secondary)' }}>
                Catalyst: {o.catalyst}. Why: {o.why} (conf {o.confidence}%)
              </p>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
