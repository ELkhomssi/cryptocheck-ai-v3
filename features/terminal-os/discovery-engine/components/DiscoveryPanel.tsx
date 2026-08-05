'use client'

/**
 * Discovery — opportunities from published Decisions only (One-Decision kernel).
 * Does not score locally via scoreTokenFromMarket / decide / buildMarketIntel.
 */

import { useEffect, useState } from 'react'
import type { Decision } from '@cryptocheck/decision-contracts'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { DiscoveryOpportunity, RiskBand } from '@/features/terminal-os/shared/types'

function riskFromDecision(d: Decision): RiskBand {
  if (d.risk < 34) return 'low'
  if (d.risk < 67) return 'moderate'
  return 'high'
}

function toOpportunity(d: Decision): DiscoveryOpportunity | null {
  if (d.subject.kind !== 'token') return null
  const id = d.subject.address || d.subject.symbol
  return {
    id,
    symbol: d.subject.symbol,
    name: d.subject.symbol,
    opportunityScore: Math.round(d.confidence),
    risk: riskFromDecision(d),
    narrative: d.reasoning.slice(0, 120),
    catalyst: d.action,
    confidence: Math.round(d.confidence),
    timeHorizon: 'intraday',
    why: d.contributingFactors
      .slice(0, 2)
      .map((f) => f.summary)
      .join(' · ') || d.reasoning.slice(0, 160),
  }
}

export function DiscoveryPanel() {
  const setFocusedToken = useTerminalOsStore((s) => s.setFocusedToken)
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const [rows, setRows] = useState<DiscoveryOpportunity[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    const qs = new URLSearchParams({ limit: '16' })
    if (wallet) qs.set('wallet', wallet)
    void fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((body: { decisions?: Decision[] }) => {
        if (c) return
        const ops = (body.decisions ?? [])
          .map(toOpportunity)
          .filter((x): x is DiscoveryOpportunity => Boolean(x))
          .sort((a, b) => b.opportunityScore - a.opportunityScore)
          .slice(0, 8)
        setRows(ops)
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
    return () => {
      c = true
    }
  }, [wallet])

  return (
    <Panel title="Discovery Engine" live>
      {error ? (
        <EmptyState message={error} />
      ) : !rows ? (
        <PanelSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState message="No Decision published yet — Discovery waits on the Decision Engine." />
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
                  chain: 'solana',
                  priceUsd: 0,
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setFocusedToken({
                    id: o.id,
                    symbol: o.symbol,
                    name: o.name,
                    chain: 'solana',
                    priceUsd: 0,
                  })
                }
              }}
            >
              <div className="tos-row-between">
                <strong>
                  {o.catalyst} ${o.symbol}
                </strong>
                <span className="tos-mono">{o.opportunityScore}%</span>
              </div>
              <p className="tos-muted">{o.why}</p>
              <p className="tos-muted">
                Risk {o.risk} · from published Decision
              </p>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
