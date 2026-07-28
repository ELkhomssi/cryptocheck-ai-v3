'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { mockSwapQuoteProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { SwapQuotePreview } from '@/features/terminal-os/shared/types'

export function QuickSwapCard() {
  const realExec = useTerminalOsStore((s) => s.featureFlags.realSwapExecution)
  const [fromAmount, setFromAmount] = useState('1')
  const [quote, setQuote] = useState<SwapQuotePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    setLoading(true)
    mockSwapQuoteProvider
      .preview('SOL', 'USDC', Number(fromAmount) || 0)
      .then((q) => {
        if (!c) setQuote(q)
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
      .finally(() => {
        if (!c) setLoading(false)
      })
    return () => {
      c = true
    }
  }, [fromAmount])

  const canSwap = realExec && quote?.executable

  return (
    <Panel title="Quick Swap">
      {error ? (
        <EmptyState message={error} />
      ) : loading || !quote ? (
        <PanelSkeleton rows={3} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--tos-text-muted)' }}>
            From {quote.fromSymbol}
            <input
              className="tos-input tos-num"
              style={{ marginTop: 4 }}
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <div style={{ fontSize: 11, color: 'var(--tos-text-muted)' }}>
            To {quote.toSymbol}
            <div
              className="tos-input tos-num"
              style={{ marginTop: 4, opacity: 0.9 }}
            >
              {quote.toAmount.toFixed(2)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--tos-text-secondary)', lineHeight: 1.45 }}>
            Slippage / impact: <span className="tos-num">{quote.priceImpactPct}%</span>
            <br />
            Platform fee: <span className="tos-num">{(quote.platformFeeBps / 100).toFixed(2)}%</span>
          </div>
          <button type="button" className="tos-btn tos-btn-gold" style={{ width: '100%' }} disabled={!canSwap}>
            {canSwap ? 'SWAP NOW' : 'SWAP NOW (preview)'}
          </button>
          {!realExec ? (
            <p className="tos-muted" style={{ fontSize: 10, lineHeight: 1.35 }}>
              Execution flagged OFF — Phase 1 is quote-only. Not financial advice · DYOR.
            </p>
          ) : null}
        </div>
      )}
    </Panel>
  )
}
