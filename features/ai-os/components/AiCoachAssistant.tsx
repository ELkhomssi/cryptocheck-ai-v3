'use client'

/**
 * AI Coach — persistent ChatGPT-like assistant.
 * Explains why / why not / confidence / alternatives / warnings.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { CoachInsight } from '@/features/terminal-os/shared/types'
import type { CoachMessage } from '../types'

const STARTERS = [
  'Why this recommendation?',
  'What are the risks?',
  'Show alternatives',
  'How confident are you?',
]

export function AiCoachAssistant({
  pendingPrompt,
  onPromptConsumed,
}: {
  pendingPrompt?: string | null
  onPromptConsumed?: () => void
}) {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const connected = useTerminalOsStore((s) => s.walletConnected)
  const { state, teach, trainAiFromMyTrading, busy } = useTradeLikeMeEngine()
  const [messages, setMessages] = useState<CoachMessage[]>([
    {
      id: 'sys-0',
      role: 'system',
      text: 'I am your AI Coach. I explain decisions, confidence, alternatives, and warnings — you approve.',
      at: new Date().toISOString(),
    },
  ])
  const [draft, setDraft] = useState('')
  const [asking, setAsking] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const ask = useCallback(
    async (raw: string) => {
      const q = raw.trim()
      if (!q || asking) return
      const userMsg: CoachMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: q,
        at: new Date().toISOString(),
      }
      setMessages((m) => [...m, userMsg])
      setDraft('')
      setAsking(true)

      if (!wallet) {
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: 'Connect a wallet so I can ground answers in your portfolio and Trader DNA.',
            at: new Date().toISOString(),
          },
        ])
        setAsking(false)
        return
      }

      try {
        if (q.length > 24) teach(q)
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
        const body = (await res.json()) as {
          answer?: string
          message?: string
          insights?: CoachInsight[]
        }
        const text =
          body.answer ||
          body.message ||
          (body.insights?.[0]
            ? `${body.insights[0].headline} — ${body.insights[0].reasoning}`
            : null) ||
          'I need more of your trading history. Train from your wallet for deeper answers.'
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text,
            at: new Date().toISOString(),
          },
        ])
      } catch {
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: 'Coach is offline momentarily — try again.',
            at: new Date().toISOString(),
          },
        ])
      } finally {
        setAsking(false)
      }
    },
    [asking, wallet, teach, state.dna],
  )

  useEffect(() => {
    if (!pendingPrompt?.trim()) return
    void ask(pendingPrompt)
    onPromptConsumed?.()
  }, [pendingPrompt, ask, onPromptConsumed])

  return (
    <section className="aios-coach" aria-label="AI Coach assistant">
      <div className="aios-coach-head">
        <p className="aios-kicker">AI Coach</p>
        <h2 className="aios-section-title">Persistent assistant</h2>
      </div>

      {!connected ? (
        <p className="aios-muted">Connect your wallet for DNA-aware coaching.</p>
      ) : null}

      {connected && (!state.dna || state.dna.sampleSize < 1) ? (
        <div className="aios-coach-train">
          <p className="aios-muted">Not enough DNA yet — train from on-chain history.</p>
          <button
            type="button"
            className="aios-btn aios-btn-ghost"
            disabled={busy}
            onClick={() => void trainAiFromMyTrading()}
          >
            {busy ? 'Learning…' : 'Train from my trading'}
          </button>
        </div>
      ) : null}

      <div className="aios-coach-thread" role="log" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className="aios-msg" data-role={m.role}>
            <p>{m.text}</p>
          </div>
        ))}
        {asking ? (
          <div className="aios-msg" data-role="assistant" data-typing="true">
            <p>Thinking…</p>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="aios-coach-starters">
        {STARTERS.map((s) => (
          <button key={s} type="button" className="aios-chip" onClick={() => void ask(s)}>
            {s}
          </button>
        ))}
      </div>

      <form
        className="aios-coach-form"
        onSubmit={(e) => {
          e.preventDefault()
          void ask(draft)
        }}
      >
        <label className="aios-sr-only" htmlFor="aios-coach-input">
          Ask the AI Coach
        </label>
        <textarea
          id="aios-coach-input"
          className="aios-coach-input"
          rows={2}
          value={draft}
          placeholder="Ask why, why not, confidence, alternatives…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(draft)
            }
          }}
        />
        <button type="submit" className="aios-btn aios-btn-primary" disabled={asking || !draft.trim()}>
          Send
        </button>
      </form>
    </section>
  )
}
