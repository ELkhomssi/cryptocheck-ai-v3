'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { ScoreRing } from '@/features/terminal-os/shared/components/ScoreRing'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { liveMarketDataProvider } from '@/features/terminal-os/shared/lib/live-providers'
import { scoreTokenFromMarket } from '@/features/terminal-os/shared/lib/score-from-market'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import type { TokenScanResult } from '@/features/terminal-os/shared/types'

export function TokenScoreScanCard() {
  const [query, setQuery] = useState('WIF')
  const [result, setResult] = useState<TokenScanResult | null>(null)
  const [meta, setMeta] = useState<{ price: number; vol: number; liq: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const tokens = await liveMarketDataProvider.getTopTokens('all')
      const needle = q.trim().toLowerCase()
      const hit =
        tokens.find(
          (t) =>
            t.symbol.toLowerCase() === needle ||
            t.id.toLowerCase() === needle ||
            t.name.toLowerCase().includes(needle),
        ) || tokens[0]
      if (!hit) throw new Error('No live token match')
      const scored = scoreTokenFromMarket(hit)
      setResult({ ...scored, symbol: hit.symbol, mintOrAddress: hit.id })
      setMeta({ price: hit.priceUsd, vol: hit.volume24hUsd, liq: hit.liquidityUsd })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void run('WIF')
  }, [])

  return (
    <Panel title="Token Score & Scan">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void run(query)
        }}
        style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}
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
          <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            <strong>${result.symbol}</strong>
            {meta ? (
              <div className="tos-muted tos-num" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: '0.2rem' }}>
                {formatUsd(meta.price)} · Vol {formatUsd(meta.vol, true)} · Liq {formatUsd(meta.liq, true)}
              </div>
            ) : null}
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
              margin: '0.65rem 0 0.5rem',
              lineHeight: 1.4,
            }}
          >
            <strong style={{ color: 'var(--tos-text-primary)' }}>Why:</strong> {result.explanation}
          </p>
          <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginBottom: '0.65rem' }}>
            Conf {result.confidence}% · {result.recommendedAction}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {result.metrics.map((m) => (
              <div key={m.label}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 'var(--tos-fs-sm)',
                    marginBottom: '0.15rem',
                  }}
                >
                  <span>{m.label}</span>
                  <span className="tos-num">{m.value}</span>
                </div>
                <div
                  style={{
                    height: '0.25rem',
                    borderRadius: '999px',
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
              </div>
            ))}
          </div>
          <button type="button" className="tos-btn tos-btn-ghost" style={{ width: '100%', marginTop: '0.75rem' }}>
            VIEW FULL SCAN
          </button>
        </div>
      )}
    </Panel>
  )
}
