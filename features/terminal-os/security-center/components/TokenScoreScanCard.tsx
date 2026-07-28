'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { ScoreRing } from '@/features/terminal-os/shared/components/ScoreRing'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { mockSecurityScanProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import type { TokenScanResult } from '@/features/terminal-os/shared/types'

export function TokenScoreScanCard() {
  const [query, setQuery] = useState('WIF')
  const [result, setResult] = useState<TokenScanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = (q: string) => {
    setLoading(true)
    setError(null)
    mockSecurityScanProvider
      .scanToken(q)
      .then(setResult)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    run('WIF')
  }, [])

  return (
    <Panel title="Token Score & Scan">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(query)
        }}
        style={{ display: 'flex', gap: 6, marginBottom: 12 }}
      >
        <input
          className="tos-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Mint or symbol"
          aria-label="Token search"
        />
        <button type="submit" className="tos-btn tos-btn-ghost">
          Scan
        </button>
      </form>
      {error ? (
        <EmptyState message={error} />
      ) : loading || !result ? (
        <PanelSkeleton rows={4} />
      ) : (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <strong>${result.symbol}</strong>
          </div>
          <ScoreRing
            score={result.score}
            band={result.band}
            label={result.band}
            sublabel={result.riskLabel}
          />
          <p style={{ fontSize: 11, color: 'var(--tos-text-secondary)', margin: '10px 0 8px', lineHeight: 1.4 }}>
            <strong style={{ color: 'var(--tos-text-primary)' }}>Why:</strong> {result.explanation}
          </p>
          <p className="tos-muted" style={{ fontSize: 10, marginBottom: 10 }}>
            Conf {result.confidence}% · Action: {result.recommendedAction}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.metrics.map((m) => (
              <div key={m.label}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    marginBottom: 3,
                  }}
                >
                  <span>{m.label}</span>
                  <span className="tos-num">{m.value}</span>
                </div>
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--tos-border-subtle)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${m.value}%`,
                      height: '100%',
                      background: 'var(--tos-positive)',
                    }}
                  />
                </div>
                <div className="tos-muted" style={{ fontSize: 9, marginTop: 2 }}>
                  {m.why}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}
