'use client'

/**
 * AI Coaching — reasoning from live TraderDNA / Decision Engine for the connected wallet.
 * Uses the client Trade Like Me orchestrator (same DNA the learning engine builds).
 */

import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { getTradeLikeMeOrchestrator } from '@/features/terminal-os/ai-trade-like-me/engines/orchestrator'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import { useCallback, useEffect, useState } from 'react'
import type { CoachInsight } from '@/features/terminal-os/shared/types'

const INSUFFICIENT =
  'Not enough data yet — connect and make a few trades, or use Pause & Teach to describe your strategy.'

function narrativeBlurb(d: ReturnType<typeof explainDecision>): string {
  return [d.confidenceLine, d.upsideLine, d.downsideLine, ...d.bullets.slice(0, 2)].join(' · ')
}

function buildInsights(wallet: string): {
  insights: CoachInsight[]
  insufficient: boolean
  message: string | null
} {
  const orch = getTradeLikeMeOrchestrator()
  const state = orch.getState({
    autonomousTrading: false,
    copyTrading: false,
    realSwapExecution: false,
  })

  if (!state.wallet || state.wallet !== wallet || !state.dna || state.dna.sampleSize < 3) {
    return {
      insights: [],
      insufficient: true,
      message: INSUFFICIENT,
    }
  }

  const dna = state.dna
  const insights: CoachInsight[] = [
    {
      id: `dna-${dna.wallet.slice(0, 8)}`,
      headline: `Your edge: ${dna.tradingStyleSummary}`,
      reasoning: `Built from ${dna.sampleSize} captured trades/rejections for this wallet.`,
      statistic: `Risk appetite ${dna.riskAppetite}/100 · ${dna.riskAppetiteLabel}`,
      expectedImpact: 'Align size and entry filters to your DNA before the next fill.',
      confidence: dna.confidence,
    },
  ]

  if (state.currentOpportunity) {
    const narrative = explainDecision(state.currentOpportunity)
    insights.push({
      id: state.currentOpportunity.id,
      headline: narrative.headline,
      reasoning: narrativeBlurb(narrative).slice(0, 280),
      statistic: narrative.confidenceLine,
      expectedImpact: `${narrative.upsideLine} · ${narrative.downsideLine}`,
      confidence: Math.round(state.currentOpportunity.scores.confidence),
    })
  }

  insights.push({
    id: `discipline-${dna.sampleSize}`,
    headline:
      dna.emotionalBiasScore > 55
        ? 'Emotional bias elevated — size down until discipline recovers'
        : 'Discipline holding — stick to your DNA entry filters',
    reasoning:
      dna.emotionalBiasScore > 55
        ? 'Late-session and loss-tolerance patterns are elevating emotional bias in your DNA.'
        : 'Your sample shows discipline within your historical entry profile.',
    statistic: `Win rate ${dna.winRatePct.toFixed(1)}% · sample ${dna.sampleSize}`,
    expectedImpact: 'Protect edge by sizing only when DNA confidence and market quality align.',
    confidence: dna.confidence,
  })

  return { insights, insufficient: false, message: null }
}

export function AiCoachingCard() {
  const setNav = useTerminalOsStore((s) => s.setActiveNav)
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const [insights, setInsights] = useState<CoachInsight[] | null>(null)
  const [insufficient, setInsufficient] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [ask, setAsk] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!walletConnected || !wallet) {
      setInsights([])
      setInsufficient(true)
      setMessage('Connect a wallet to unlock Coach reasoning over your Trader DNA.')
      setAnswer(null)
      return
    }
    const next = buildInsights(wallet)
    setInsights(next.insights)
    setInsufficient(next.insufficient)
    setMessage(next.message)
  }, [wallet, walletConnected])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 4_000)
    return () => window.clearInterval(id)
  }, [load])

  const askCoach = async () => {
    if (!wallet) return
    setAnswer(null)
    const orch = getTradeLikeMeOrchestrator()
    const state = orch.getState({
      autonomousTrading: false,
      copyTrading: false,
      realSwapExecution: false,
    })

    if (!state.wallet || state.wallet !== wallet || !state.dna || state.dna.sampleSize < 3) {
      setAnswer(INSUFFICIENT)
      load()
      return
    }

    const q = ask.trim() || 'What should I focus on?'
    if (q.length > 20) orch.teach(q)

    const dna = state.dna
    void fetch('/api/terminal-os/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet,
        question: q,
        dna: {
          sampleSize: dna.sampleSize,
          confidence: dna.confidence,
          tradingStyleSummary: dna.tradingStyleSummary,
          riskAppetiteLabel: dna.riskAppetiteLabel,
          winRatePct: dna.winRatePct,
        },
      }),
    })

    const opp = state.currentOpportunity
    const narrative = opp ? explainDecision(opp) : null
    setAnswer(
      [
        `Context: ${dna.tradingStyleSummary} (confidence ${dna.confidence}%).`,
        narrative
          ? `Live opportunity: ${narrative.headline} — ${narrativeBlurb(narrative)}`
          : 'No live opportunity scored yet — activate AI Trading and refresh the desk.',
        `Risk band: ${dna.riskAppetiteLabel}. Sample size ${dna.sampleSize}.`,
        `You asked: “${q.slice(0, 160)}”`,
      ].join(' '),
    )
    load()
  }

  const top = insights?.[0]

  return (
    <Panel
      title="AI Coaching"
      action={
        <span
          style={{
            fontSize: '0.5625rem',
            fontWeight: 700,
            color: 'var(--tos-accent-gold)',
            border: '1px solid color-mix(in srgb, var(--tos-accent-gold) 40%, transparent)',
            borderRadius: 4,
            padding: '1px 5px',
          }}
        >
          LIVE
        </span>
      }
    >
      {insights == null ? (
        <PanelSkeleton rows={2} />
      ) : insufficient || !top ? (
        <EmptyState message={message ?? INSUFFICIENT} />
      ) : (
        <div>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              marginBottom: '0.45rem',
            }}
          >
            <div
              style={{
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '999px',
                background: 'var(--tos-accent-gold-dim)',
                color: 'var(--tos-accent-gold)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 'var(--tos-fs-xs)',
              }}
            >
              C
            </div>
            <strong style={{ fontSize: 'var(--tos-fs-sm)' }}>Coach</strong>
          </div>
          <p style={{ fontSize: 'var(--tos-fs-sm)', fontWeight: 700, marginBottom: '0.35rem' }}>
            {top.headline}
          </p>
          <ul
            className="tos-muted"
            style={{
              margin: '0 0 0.5rem',
              paddingLeft: '1rem',
              fontSize: 'var(--tos-fs-xs)',
              lineHeight: 1.4,
            }}
          >
            {insights.slice(0, 3).map((i) => (
              <li key={i.id}>
                Conf {i.confidence}% · {i.statistic}
              </li>
            ))}
          </ul>
          <label className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', display: 'block' }}>
            Ask Coach AI
            <input
              className="tos-input"
              style={{ marginTop: 4 }}
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="What should I focus on?"
            />
          </label>
          <button
            type="button"
            className="tos-btn tos-btn-gold"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => void askCoach()}
          >
            ASK COACH AI
          </button>
          {answer ? (
            <p style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 8, lineHeight: 1.45 }}>{answer}</p>
          ) : null}
          <button
            type="button"
            className="tos-btn tos-btn-ghost"
            style={{ width: '100%', marginTop: 6 }}
            onClick={() => setNav('ai-coach')}
          >
            Open Coach desk
          </button>
        </div>
      )}
    </Panel>
  )
}
