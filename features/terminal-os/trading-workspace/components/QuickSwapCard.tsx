'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { liveMarketDataProvider } from '@/features/terminal-os/shared/lib/live-providers'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { SwapQuotePreview } from '@/features/terminal-os/shared/types'

export function QuickSwapCard() {
  const realExec = useTerminalOsStore((s) => s.featureFlags.realSwapExecution)
  const [fromAmount, setFromAmount] = useState('1')
  const [fromSymbol] = useState('SOL')
  const [toSymbol] = useState('USDC')
  const [quote, setQuote] = useState<SwapQuotePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    setLoading(true)
    ;(async () => {
      try {
        const ticker = await liveMarketDataProvider.getTickerQuotes()
        const sol = ticker.find((t) => t.symbol === 'SOL')
        const amount = Number(fromAmount) || 0
        const price = sol?.priceUsd ?? 0
        const next: SwapQuotePreview = {
          fromSymbol,
          toSymbol,
          fromAmount: amount,
          toAmount: amount * price,
          priceImpactPct: amount > 50 ? 0.35 : 0.08,
          platformFeeBps: 30,
          executable: false,
        }
        if (!c) setQuote(next)
      } catch (e) {
        if (!c) setError(e instanceof Error ? e.message : 'Quote failed')
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [fromAmount, fromSymbol, toSymbol])

  const canSwap = realExec && quote?.executable

  return (
    <Panel title="Quick Swap">
      {error ? (
        <EmptyState message={error} />
      ) : loading || !quote ? (
        <PanelSkeleton rows={3} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <label style={{ fontSize: 'var(--tos-fs-xs)', color: 'var(--tos-text-muted)' }}>
            From {quote.fromSymbol}
            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
              <input
                className="tos-input tos-num"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                inputMode="decimal"
              />
              <button
                type="button"
                className="tos-btn tos-btn-ghost"
                onClick={() => setFromAmount('1')}
              >
                MAX
              </button>
            </div>
          </label>
          <div style={{ fontSize: 'var(--tos-fs-xs)', color: 'var(--tos-text-muted)' }}>
            To {quote.toSymbol}
            <div className="tos-input tos-num" style={{ marginTop: '0.25rem', opacity: 0.9 }}>
              {quote.toAmount.toFixed(2)}
            </div>
          </div>
          <div
            style={{ fontSize: 'var(--tos-fs-sm)', color: 'var(--tos-text-secondary)', lineHeight: 1.45 }}
          >
            Rate: <span className="tos-num">1 {quote.fromSymbol} ≈ {(quote.toAmount / (quote.fromAmount || 1)).toFixed(2)} {quote.toSymbol}</span>
            <br />
            Impact: <span className="tos-num">{quote.priceImpactPct}%</span>
            <br />
            Platform fee: <span className="tos-num">{(quote.platformFeeBps / 100).toFixed(2)}%</span>
            <br />
            Slippage limit: <span className="tos-num">1.00%</span>
          </div>
          <button type="button" className="tos-btn tos-btn-gold" style={{ width: '100%' }} disabled={!canSwap}>
            {canSwap ? 'SWAP NOW' : 'SWAP NOW'}
          </button>
          {!realExec ? (
            <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', lineHeight: 1.35 }}>
              Live SOL price · execution flagged OFF. Not financial advice · DYOR.
            </p>
          ) : null}
        </div>
      )}
    </Panel>
  )
}
