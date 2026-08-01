'use client'

/**
 * Discovery — filtered/sorted view over Decision Engine output (Layer 4).
 * Does not invent opportunityScore — confidence/action come from Decision only.
 */

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { liveMarketDataProvider } from '@/features/terminal-os/shared/lib/live-providers'
import { decideForToken } from '@/features/terminal-os/ai-trade-like-me/lib/decide-for-token'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { DiscoveryOpportunity, RiskBand, TokenRow } from '@/features/terminal-os/shared/types'

const HIGH_CONVICTION_MIN = 70

function toOpportunity(t: TokenRow): DiscoveryOpportunity | null {
  const { decision } = decideForToken({ token: t, dna: null })
  // Discovery = Decision view, not a separate ranking algorithm
  if (decision.action !== 'BUY' && decision.action !== 'WAIT') return null
  if (decision.confidence < HIGH_CONVICTION_MIN) return null

  const risk = (
    decision.risk >= 70 ? 'high' : decision.risk >= 45 ? 'moderate' : 'low'
  ) as RiskBand

  return {
    id: t.id,
    symbol: t.symbol,
    name: t.name,
    opportunityScore: decision.confidence,
    risk,
    narrative: decision.reasoning.slice(0, 120),
    catalyst: `${decision.action} · Decision ${decision.id.slice(0, 12)}`,
    confidence: decision.confidence,
    timeHorizon: 'intraday',
    why: decision.contributingFactors
      .slice(0, 3)
      .map((f) => f.summary)
      .join(' · ') || decision.reasoning,
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
        const scored = tokens
          .slice(0, 16)
          .map(toOpportunity)
          .filter((o): o is DiscoveryOpportunity => o != null)
          .sort((a, b) => b.opportunityScore - a.opportunityScore)
          .slice(0, 8)
        setRows(scored)
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
        <EmptyState message="No live Decisions ranked yet — Decision Engine has no high-conviction BUY/WAIT." />
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
                  Decision {o.opportunityScore}
                </span>
              </div>
              <div className="tos-card-tile-meta">
                {o.narrative} · Risk {o.risk} · {o.timeHorizon}
              </div>
              <p className="tos-card-tile-meta" style={{ color: 'var(--tos-text-secondary)' }}>
                {o.catalyst}. Why: {o.why} (conf {o.confidence}%)
              </p>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
