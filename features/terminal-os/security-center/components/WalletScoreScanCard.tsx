'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { ScoreRing } from '@/features/terminal-os/shared/components/ScoreRing'
import { PanelSkeleton, StaleIndicator } from '@/features/terminal-os/shared/components/PanelStates'
import { mockSecurityScanProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import type { WalletScanResult } from '@/features/terminal-os/shared/types'

export function WalletScoreScanCard() {
  const [query, setQuery] = useState('0x7a8…9f2b')
  const [result, setResult] = useState<WalletScanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = (q: string) => {
    setLoading(true)
    setError(null)
    mockSecurityScanProvider
      .scanWallet(q)
      .then(setResult)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    run('0x7a89f2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f')
  }, [])

  return (
    <Panel title="Wallet Score & Scan">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(query)
        }}
        style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}
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
          <StaleIndicator stale demo source="wallet-scan-fallback" />
          <PanelSkeleton rows={3} />
        </div>
      ) : loading || !result ? (
        <PanelSkeleton rows={3} />
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
          <div
            className="tos-muted tos-num"
            style={{ fontSize: 'var(--tos-fs-xs)', marginTop: '0.4rem', lineHeight: 1.45 }}
          >
            Conf {result.confidence}%
            <br />
            Approvals: review recommended
            <br />
            Funding graph: organic (90d)
            <br />
            Malicious tags: none
          </div>
          <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: '0.35rem' }}>
            {result.recommendedAction}
          </p>
          <button type="button" className="tos-btn tos-btn-ghost" style={{ width: '100%', marginTop: '0.75rem' }}>
            VIEW WALLET ANALYSIS
          </button>
        </div>
      )}
    </Panel>
  )
}
