'use client'

/**
 * Wallet Score — real connected-wallet session or user-entered address.
 * Uses portfolio holdings + on-chain balance heuristics (no mock provider).
 */

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { ScoreRing } from '@/features/terminal-os/shared/components/ScoreRing'
import { EmptyState, PanelSkeleton, StaleIndicator } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import type { ScoreBand, WalletScanResult } from '@/features/terminal-os/shared/types'

function bandFromScore(score: number): ScoreBand {
  if (score >= 80) return 'excellent'
  if (score >= 65) return 'good'
  if (score >= 45) return 'caution'
  return 'danger'
}

function scoreFromHoldings(h: HoldingsResponse): WalletScanResult {
  const n = h.holdings.length
  const topShare = n ? Math.max(...h.holdings.map((x) => x.allocationPct)) : 100
  const diversification = Math.max(5, Math.min(95, Math.round(100 - topShare * 0.65 + Math.min(n, 15) * 2)))
  const solBoost = h.availableSol > 0.05 ? 8 : 0
  const score = Math.max(8, Math.min(96, diversification + solBoost))
  const band = bandFromScore(score)
  const trunc =
    h.walletAddress.length > 10
      ? `${h.walletAddress.slice(0, 4)}…${h.walletAddress.slice(-4)}`
      : h.walletAddress

  return {
    address: h.walletAddress,
    addressTruncated: trunc,
    score,
    band,
    riskLabel:
      band === 'excellent'
        ? 'Healthy diversification'
        : band === 'good'
          ? 'Acceptable concentration'
          : band === 'caution'
            ? 'Concentrated book'
            : 'High concentration risk',
    confidence: Math.min(92, 40 + n * 4),
    explanation: `Live holdings · ${n} tokens · $${h.totalValueUsd.toFixed(0)} total · top allocation ${topShare.toFixed(0)}%.`,
    recommendedAction:
      band === 'danger' || band === 'caution'
        ? 'Reduce concentration before sizing new risk.'
        : 'Book looks balanced — still verify liquidity before swaps.',
  }
}

export function WalletScoreScanCard() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const chainFamily = useTerminalOsStore((s) => s.walletChainFamily)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<WalletScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (q: string) => {
    const address = q.trim()
    if (!address) {
      setError('Enter a Solana wallet address or connect one.')
      setResult(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/portfolio/holdings?wallet=${encodeURIComponent(address)}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || 'Holdings unavailable')
      }
      const holdings = (await res.json()) as HoldingsResponse
      setResult(scoreFromHoldings(holdings))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet scan failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (walletConnected && wallet && chainFamily !== 'evm') {
      setQuery(wallet)
      void run(wallet)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run when session wallet changes
  }, [wallet, walletConnected, chainFamily])

  return (
    <Panel title="Wallet Score & Scan" live={Boolean(result)}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void run(query)
        }}
        className="tos-scan-form"
      >
        <input
          className="tos-input tos-mono"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Wallet address"
          aria-label="Wallet search"
        />
        <button type="submit" className="tos-btn tos-btn-ghost">
          Scan
        </button>
      </form>
      {error ? (
        <div>
          <StaleIndicator stale source="portfolio-holdings" />
          <EmptyState message={error} />
        </div>
      ) : loading || (!result && walletConnected) ? (
        <PanelSkeleton rows={3} />
      ) : !result ? (
        <EmptyState message="Connect a Solana wallet or paste an address to score live holdings." />
      ) : (
        <div>
          <div
            className="tos-mono tos-secondary"
            style={{ textAlign: 'center', fontSize: 'var(--tos-fs-sm)', marginBottom: '0.5rem' }}
          >
            {result.addressTruncated}
          </div>
          <ScoreRing
            score={result.score}
            band={result.band}
            label={result.band.toUpperCase()}
            sublabel={result.riskLabel}
          />
          <p
            style={{
              fontSize: 'var(--tos-fs-sm)',
              color: 'var(--tos-text-secondary)',
              marginTop: '0.65rem',
              lineHeight: 1.4,
            }}
          >
            <strong style={{ color: 'var(--tos-text-primary)' }}>Why:</strong> {result.explanation}
          </p>
        </div>
      )}
    </Panel>
  )
}
