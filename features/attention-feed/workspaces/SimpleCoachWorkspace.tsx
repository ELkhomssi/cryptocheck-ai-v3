'use client'

/**
 * Simple Mode AI Coach — conversational, Pause & Teach, live DNA/coach API.
 * Does not mount Pro AiCoachingCard (avoids Pro vocabulary leakage).
 */

import { useCallback, useState } from 'react'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { CoachInsight } from '@/features/terminal-os/shared/types'
import { AttentionCard } from '../components/AttentionCard'
import { SimpleSecureAccount } from '../components/SimpleSecureAccount'
import { useAttentionFeed } from '../hooks/useAttentionFeed'

export function SimpleCoachWorkspace() {
  const { items, isLoading } = useAttentionFeed('coach')
  const { teach, state, trainAiFromMyTrading, busy, error } = useTradeLikeMeEngine()
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const [ask, setAsk] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  const askCoach = useCallback(async () => {
    if (!wallet) return
    const q = ask.trim() || 'What should I focus on?'
    setAsking(true)
    setAnswer(null)
    try {
      if (q.length > 20) teach(q)
      const res = await fetch('/api/terminal-os/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          question: q,
          dna: state.dna
            ? {
                sampleSize: state.dna.sampleSize,
                confidence: state.dna.confidence,
                tradingStyleSummary: state.dna.tradingStyleSummary,
                riskAppetiteLabel: state.dna.riskAppetiteLabel,
                winRatePct: state.dna.winRatePct,
              }
            : undefined,
        }),
      })
      const body = (await res.json()) as { answer?: string; message?: string; insights?: CoachInsight[] }
      setAnswer(
        body.answer ||
          body.message ||
          (body.insights?.[0] ? `${body.insights[0].headline} — ${body.insights[0].reasoning}` : null) ||
          'Coach needs more of your history. Train from your wallet to unlock deeper answers.',
      )
    } catch {
      setAnswer('Coach is offline right now — try again in a moment.')
    } finally {
      setAsking(false)
    }
  }, [wallet, ask, teach, state.dna])

  if (!walletConnected) {
    return (
      <div className="sm-workspace">
        <h2 className="sm-workspace-title">AI Coach</h2>
        <p className="sm-workspace-q">What happened, why, and what should you do?</p>
        <p className="sm-empty">Connect your Secure Account so Coach can use your Trader DNA.</p>
        <SimpleSecureAccount />
      </div>
    )
  }

  return (
    <div className="sm-workspace">
      <h2 className="sm-workspace-title">AI Coach</h2>
      <p className="sm-workspace-q">What happened, why, and what should you do?</p>

      {!state.dna || state.dna.sampleSize < 1 ? (
        <div className="sm-exec-card">
          <p className="sm-empty">Not enough data yet — train from your on-chain history.</p>
          <button
            type="button"
            className="sm-btn sm-btn-primary"
            disabled={busy}
            onClick={() => void trainAiFromMyTrading()}
          >
            {busy ? 'Learning…' : 'Train from my trading'}
          </button>
          {error ? <p className="sm-error">{error}</p> : null}
        </div>
      ) : null}

      <div className="sm-feed">
        {isLoading && !items.length ? <p className="sm-muted-line">Loading coach context…</p> : null}
        {items.map((item) => (
          <AttentionCard key={item.id} item={item} />
        ))}
      </div>

      <div className="sm-coach-ask">
        <label className="sm-field">
          <span className="sm-label">Pause & Teach / Ask</span>
          <textarea
            className="sm-input sm-textarea"
            rows={3}
            placeholder="Tell Coach why you disagreed, or ask what to focus on…"
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="sm-btn sm-btn-primary"
          disabled={asking}
          onClick={() => void askCoach()}
        >
          {asking ? 'Thinking…' : 'Ask Coach'}
        </button>
        {answer ? <p className="sm-coach-answer">{answer}</p> : null}
      </div>
    </div>
  )
}
