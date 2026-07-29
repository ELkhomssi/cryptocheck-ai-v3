'use client'

import { useCallback, useEffect, useState, startTransition } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { ScoreRing } from '@/features/terminal-os/shared/components/ScoreRing'
import { PanelSkeleton, StaleIndicator } from '@/features/terminal-os/shared/components/PanelStates'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { scoreTokenFromMarket } from '@/features/terminal-os/shared/lib/score-from-market'
import { liveMarketDataProvider } from '@/features/terminal-os/shared/lib/live-providers'
import type { TokenScanResult } from '@/features/terminal-os/shared/types'

type ScanMeta = { price: number; vol: number; liq: number }

export function TokenScoreScanCard() {
  const [query, setQuery] = useState('WIF')
  const [result, setResult] = useState<TokenScanResult | null>(null)
  const [meta, setMeta] = useState<ScanMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [demo, setDemo] = useState(false)
  const [ageSec, setAgeSec] = useState(0)
  const [source, setSource] = useState<string | undefined>()

  const run = useCallback(async (q: string) => {
    setLoading(true)
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
      if (hit) {
        const optimistic = scoreTokenFromMarket(hit)
        startTransition(() => {
          setResult({ ...optimistic, symbol: hit.symbol, mintOrAddress: hit.id })
          setMeta({ price: hit.priceUsd, vol: hit.volume24hUsd, liq: hit.liquidityUsd })
          setLoading(false)
        })
      }
    } catch {
      /* continue to API */
    }

    try {
      const res = await fetch('/api/terminal-os/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const body = (await res.json()) as {
        result: TokenScanResult
        meta: ScanMeta
        stale?: boolean
        demo?: boolean
        ageSec?: number
        source?: string
      }
      startTransition(() => {
        setResult(body.result)
        setMeta(body.meta)
        setStale(Boolean(body.stale))
        setDemo(Boolean(body.demo))
        setAgeSec(body.ageSec ?? 0)
        setSource(body.source)
        setLoading(false)
      })
    } catch {
      setStale(true)
      setDemo(true)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void run('WIF')
  }, [run])

  return (
    <Panel title="Token Score & Scan" live>
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
      <StaleIndicator stale={stale} demo={demo} ageSec={ageSec} source={source} />
      {loading && !result ? (
        <PanelSkeleton rows={4} />
      ) : !result ? (
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
                      transition: 'width 280ms ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}
