'use client'

import { useCallback, useEffect, useState, startTransition } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { ScoreRing } from '@/features/terminal-os/shared/components/ScoreRing'
import { PanelSkeleton, StaleIndicator } from '@/features/terminal-os/shared/components/PanelStates'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { scoreTokenFromMarket } from '@/features/terminal-os/shared/lib/score-from-market'
import { liveMarketDataProvider } from '@/features/terminal-os/shared/lib/live-providers'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { TokenScanResult } from '@/features/terminal-os/shared/types'

type ScanMeta = { price: number; vol: number; liq: number }

export function TokenScoreScanCard() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const [query, setQuery] = useState(focused?.symbol || focused?.id || 'SOL')
  const [result, setResult] = useState<TokenScanResult | null>(null)
  const [meta, setMeta] = useState<ScanMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [demo, setDemo] = useState(false)
  const [ageSec, setAgeSec] = useState(0)
  const [source, setSource] = useState<string | undefined>()

  const run = useCallback(async (q: string) => {
    const needle = q.trim()
    if (!needle) return
    setLoading(true)
    try {
      const tokens = await liveMarketDataProvider.getTopTokens('all')
      const lower = needle.toLowerCase()
      const hit =
        tokens.find(
          (t) =>
            t.symbol.toLowerCase() === lower ||
            t.id.toLowerCase() === lower ||
            t.name.toLowerCase().includes(lower),
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
        body: JSON.stringify({ query: needle }),
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
      setLoading(false)
    }
  }, [])

  // Keep scanner synchronized with OS-focused token
  useEffect(() => {
    const next = focused?.id || focused?.symbol
    if (!next) return
    setQuery(focused?.symbol || next)
    void run(next)
  }, [focused?.id, focused?.symbol, run])

  useEffect(() => {
    if (focused?.id || focused?.symbol) return
    void run(query || 'SOL')
    // initial only when nothing focused
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Panel title="Token Score & Scan" live>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void run(query)
        }}
        className="tos-scan-form"
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
          <div className="tos-stack-sm">
            {result.metrics.map((m) => (
              <div key={m.label}>
                <div className="tos-row-between" style={{ fontSize: 'var(--tos-fs-sm)', marginBottom: '0.125rem' }}>
                  <span>{m.label}</span>
                  <span className="tos-num">{m.value}</span>
                </div>
                <div className="tos-progress">
                  <div className="tos-progress-fill" style={{ width: `${m.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}
