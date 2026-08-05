'use client'

/**
 * AI Coaching — reads published Decision + Redis DNA only (One-Decision kernel).
 * Does not import decide / buildMarketIntel / client orchestrator for opinions.
 */

import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useCallback, useEffect, useState } from 'react'
import type { Decision } from '@cryptocheck/decision-contracts'
import type { CoachInsight } from '@/features/terminal-os/shared/types'
import { selectHeroDecision } from '@/features/ai-os/lib/gateway-round2'

const INSUFFICIENT =
  'Not enough data yet — connect and make a few trades so Trader DNA can learn from real fills.'

export function AiCoachingCard() {
  const setNav = useTerminalOsStore((s) => s.setActiveNav)
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const [insights, setInsights] = useState<CoachInsight[] | null>(null)
  const [insufficient, setInsufficient] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [ask, setAsk] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!walletConnected || !wallet) {
      setInsights([])
      setInsufficient(true)
      setMessage('Connect a wallet to unlock Coach reasoning over your Trader DNA.')
      setAnswer(null)
      return
    }

    try {
      const [coachRes, decRes] = await Promise.all([
        fetch(`/api/terminal-os/coach?wallet=${encodeURIComponent(wallet)}`, {
          cache: 'no-store',
        }),
        fetch(
          `/api/terminal-os/decisions?limit=8&wallet=${encodeURIComponent(wallet)}`,
          { cache: 'no-store' },
        ),
      ])
      const coachBody = (await coachRes.json()) as {
        insights?: CoachInsight[]
        insufficientData?: boolean
        message?: string
      }
      const decBody = (await decRes.json()) as { decisions?: Decision[] }
      const hero = selectHeroDecision(decBody.decisions ?? [])

      const fromDecision: CoachInsight[] = hero
        ? [
            {
              id: hero.id,
              headline: `${hero.action}${hero.subject.kind === 'token' ? ` $${hero.subject.symbol}` : ''}`,
              reasoning: hero.reasoning.slice(0, 280),
              statistic: `Confidence ${Math.round(hero.confidence)}% · risk ${Math.round(hero.risk)}`,
              expectedImpact: hero.contributingFactors
                .slice(0, 2)
                .map((f) => f.summary)
                .join(' · '),
              confidence: Math.round(hero.confidence),
            },
          ]
        : []

      const fromCoach =
        !coachBody.insufficientData && coachBody.insights?.length ? coachBody.insights : []

      const merged = [...fromDecision, ...fromCoach].slice(0, 6)
      if (!merged.length) {
        setInsights([])
        setInsufficient(true)
        setMessage(coachBody.message ?? INSUFFICIENT)
        return
      }
      setInsights(merged)
      setInsufficient(false)
      setMessage(null)
    } catch {
      setInsights([])
      setInsufficient(true)
      setMessage(INSUFFICIENT)
    }
  }, [wallet, walletConnected])

  useEffect(() => {
    let cancelled = false
    const tick = () => {
      void load().catch(() => {
        if (!cancelled) {
          /* soft */
        }
      })
    }
    tick()
    const id = window.setInterval(tick, 12_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [load])

  const askCoach = async () => {
    if (!wallet) return
    setAnswer(null)
    const q = ask.trim() || 'What should I focus on?'
    try {
      const res = await fetch('/api/terminal-os/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, question: q }),
      })
      const body = (await res.json()) as { answer?: string; error?: string }
      setAnswer(body.answer ?? body.error ?? 'Coach unavailable')
    } catch {
      setAnswer('Coach unavailable')
    }
  }

  return (
    <Panel title="AI Coaching" live>
      {!walletConnected ? (
        <EmptyState message="Connect a wallet to unlock Coach." />
      ) : insights == null ? (
        <PanelSkeleton rows={4} />
      ) : insufficient ? (
        <EmptyState message={message ?? INSUFFICIENT} />
      ) : (
        <div className="tos-stack-sm">
          {insights.map((i) => (
            <article key={i.id} className="tos-card-tile">
              <strong>{i.headline}</strong>
              <p className="tos-muted">{i.reasoning}</p>
              <p className="tos-mono">{i.statistic}</p>
            </article>
          ))}
          <label className="tos-muted">
            Ask coach
            <input
              className="tos-input"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="What should I focus on?"
            />
          </label>
          <button type="button" className="tos-btn" onClick={() => void askCoach()}>
            Ask
          </button>
          {answer ? <p className="tos-muted">{answer}</p> : null}
          <button type="button" className="tos-btn-ghost" onClick={() => setNav('ai-coach')}>
            Open full Coach
          </button>
        </div>
      )}
    </Panel>
  )
}
