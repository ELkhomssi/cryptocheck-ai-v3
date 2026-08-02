'use client'

/**
 * Discovery — filtered/sorted view over server-persisted Decisions (Layer 4).
 * Uses marketConfidence for untrained wallets — never invents opportunityScore.
 */

import { useEffect, useState } from 'react'
import type { Decision } from '@cryptocheck/decision-contracts'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton, StaleIndicator } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { DiscoveryOpportunity, RiskBand } from '@/features/terminal-os/shared/types'

const HIGH_CONVICTION_MIN = 70

function fromDecision(d: Decision): DiscoveryOpportunity | null {
  const conf = d.marketConfidence ?? d.confidence
  if (d.action !== 'BUY' && d.action !== 'WAIT') return null
  // Discovery uses market-quality confidence — both BUY and WAIT need ≥70
  if (conf < HIGH_CONVICTION_MIN) return null

  const risk = (d.risk >= 70 ? 'high' : d.risk >= 45 ? 'moderate' : 'low') as RiskBand
  const symbol = d.subject.kind === 'token' ? d.subject.symbol : d.subject.address.slice(0, 6)

  return {
    id: d.subject.kind === 'token' ? d.subject.address || d.id : d.id,
    symbol,
    name: symbol,
    opportunityScore: conf,
    risk,
    narrative: d.reasoning.slice(0, 140),
    catalyst: `${d.action} · ${d.confidenceMode} conf ${conf}%`,
    confidence: conf,
    timeHorizon: 'intraday',
    why:
      d.contributingFactors
        .slice(0, 3)
        .map((f) => f.summary)
        .join(' · ') || d.reasoning,
  }
}

export function DiscoveryPanel() {
  const setFocusedToken = useTerminalOsStore((s) => s.setFocusedToken)
  const chain = useTerminalOsStore((s) => s.tokenChainTab)
  const [rows, setRows] = useState<DiscoveryOpportunity[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let c = false
    fetch('/api/terminal-os/decisions?limit=16', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Decisions unavailable')
        const body = (await res.json()) as { decisions?: Decision[] }
        if (c) return
        const scored = (body.decisions ?? [])
          .map(fromDecision)
          .filter((o): o is DiscoveryOpportunity => o != null)
          .sort((a, b) => b.opportunityScore - a.opportunityScore)
          .slice(0, 8)
        setRows(scored)
        setLive(true)
        setError(null)
      })
      .catch((e: Error) => {
        if (!c) {
          setError(e.message)
          setRows([])
          setLive(false)
        }
      })
    return () => {
      c = true
    }
  }, [chain])

  return (
    <Panel title="Discovery Engine" live={live && !error}>
      {error ? (
        <>
          <StaleIndicator stale source="decision-engine" />
          <EmptyState message={error} />
        </>
      ) : !rows ? (
        <PanelSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState message="No high-conviction Decisions yet — waiting for Decision Engine tick." />
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
