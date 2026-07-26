'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import type { HoldingRecommendation, PortfolioReviewResponse } from '@/types/portfolio-desk'

function actionColor(action: HoldingRecommendation['action']): string {
  switch (action) {
    case 'Buy':
      return 'var(--pd-positive)'
    case 'Reduce':
      return 'var(--pd-accent-bright)'
    case 'Exit':
      return 'var(--pd-negative)'
    default:
      return 'var(--pd-text-dim)'
  }
}

export function AiReviewPanel() {
  const { walletAddress, isConnected, connect } = useSolana()

  const availQ = useQuery({
    queryKey: ['portfolio-review-available'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio/review', { cache: 'no-store' })
      const body = (await res.json()) as { available?: boolean }
      return Boolean(body.available)
    },
    staleTime: 60_000,
  })

  const reviewMut = useMutation({
    mutationFn: async (): Promise<PortfolioReviewResponse> => {
      if (!walletAddress) throw new Error('Wallet required')
      const res = await fetch('/api/portfolio/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      })
      const body = (await res.json().catch(() => ({}))) as PortfolioReviewResponse & {
        error?: string
      }
      if (!res.ok) throw new Error(body.error || 'Review failed')
      return body
    },
  })

  return (
    <section className="pd-panel" style={{ padding: 0 }}>
      <div className="pd-panel-head">
        <h2>AI Review</h2>
        <span style={{ fontSize: 12, color: 'var(--pd-accent)', fontWeight: 600 }}>
          {availQ.data === false ? 'Offline' : 'Claude'}
        </span>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <p style={{ fontSize: 13, color: 'var(--pd-text-dim)', marginBottom: 12, lineHeight: 1.45 }}>
          Structured Hold / Buy / Reduce / Exit recommendations per holding, citing analytics
          numbers. Never invents missing PnL.
        </p>

        {!isConnected ? (
          <button type="button" className="pd-connect" onClick={() => void connect()}>
            Connect Wallet
          </button>
        ) : (
          <button
            type="button"
            className="pd-connect"
            disabled={reviewMut.isPending || availQ.data === false}
            onClick={() => reviewMut.mutate()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            {reviewMut.isPending ? 'Reviewing…' : 'Run AI review'}
          </button>
        )}

        {availQ.data === false ? (
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--pd-text-faint)' }}>
            OPENAI_API_KEY is not configured on the server.
          </p>
        ) : null}

        {reviewMut.isError ? (
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--pd-negative)' }}>
            {(reviewMut.error as Error)?.message || 'Review failed'}
          </p>
        ) : null}

        {reviewMut.isPending ? (
          <div style={{ marginTop: 14 }}>
            <div className="pd-skeleton" style={{ height: 48, marginBottom: 8 }} />
            <div className="pd-skeleton" style={{ height: 48, marginBottom: 8 }} />
            <div className="pd-skeleton" style={{ height: 48 }} />
          </div>
        ) : null}

        {reviewMut.data ? (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{reviewMut.data.summary}</p>
            {reviewMut.data.limitations ? (
              <p style={{ fontSize: 11.5, color: 'var(--pd-text-faint)', marginBottom: 12 }}>
                {reviewMut.data.limitations}
              </p>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reviewMut.data.recommendations.map((r) => (
                <div
                  key={r.mint}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--pd-surface-2)',
                    borderRadius: 'var(--pd-radius)',
                    border: '1px solid var(--pd-border-soft)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{r.symbol}</span>
                    <span
                      className="pd-num"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: actionColor(r.action),
                      }}
                    >
                      {r.action}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--pd-text-dim)', lineHeight: 1.45, margin: 0 }}>
                    {r.rationale}
                  </p>
                </div>
              ))}
            </div>
            <p
              className="pd-ask-note"
              style={{ marginTop: 12, marginBottom: 0 }}
            >
              {reviewMut.data.disclaimer}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
