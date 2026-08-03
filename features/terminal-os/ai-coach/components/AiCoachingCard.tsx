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
  // DNA facts only — no actionable prescriptions without a Decision
  const insights: CoachInsight[] = [
    {
      id: `dna-${dna.wallet.slice(0, 8)}`,
      headline: `Your edge: ${dna.tradingStyleSummary}`,
      reasoning: `Built from ${dna.sampleSize} captured trades/rejections for this wallet.`,
      statistic: `Risk appetite ${dna.riskAppetite}/100 · ${dna.riskAppetiteLabel}`,
      expectedImpact: 'TraderDNA profile loaded — Coach awaits a Decision to personalize tone.',
      confidence: dna.confidence,
    },
  ]

  if (state.currentOpportunity) {
    const narrative = explainDecision(state.currentOpportunity)
    const opp = state.currentOpportunity
    insights.push({
      id: opp.id,
      headline: narrative.headline,
      reasoning: narrativeBlurb(narrative).slice(0, 280),
      statistic: narrative.confidenceLine,
      expectedImpact: `${narrative.upsideLine} · ${narrative.downsideLine}`,
      confidence: Math.round(opp.scores.confidence),
    })
    // Discipline tone is derived FROM Decision + DNA facts — not an independent opinion
    insights.push({
      id: `discipline-${opp.id}`,
      headline:
        dna.emotionalBiasScore > 55 && (opp.action === 'BUY' || opp.action === 'SELL')
          ? `${opp.action} with elevated emotional-bias score — Decision confidence ${Math.round(opp.scores.confidence)}%`
          : `Decision ${opp.action} · Coach mirrors Decision Engine (no independent score)`,
      reasoning: [
        ...opp.reasons.slice(0, 2),
        dna.emotionalBiasScore > 55
          ? `DNA emotionalBiasScore ${dna.emotionalBiasScore}/100 (fact) — tone only; action is Decision.${opp.action}.`
          : `DNA sample ${dna.sampleSize} · win ${dna.winRatePct.toFixed(1)}% (facts).`,
      ].join(' · '),
      statistic: `Decision conf ${Math.round(opp.scores.confidence)}% · DNA conf ${dna.confidence}%`,
      expectedImpact: narrative.confidenceLine,
      confidence: Math.round(opp.scores.confidence),
    })
  }

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

  const load = useCallback(async () => {
    if (!walletConnected || !wallet) {
      setInsights([])
      setInsufficient(true)
      setMessage('Connect a wallet to unlock Coach reasoning over your Trader DNA.')
      setAnswer(null)
      return
    }
    const local = buildInsights(wallet)
    if (!local.insufficient) {
      setInsights(local.insights)
      setInsufficient(false)
      setMessage(null)
      return
    }
    // Fall back to server (Redis-persisted DNA) when client session is cold
    try {
      const res = await fetch(`/api/terminal-os/coach?wallet=${encodeURIComponent(wallet)}`)
      if (!res.ok) throw new Error('Coach offline')
      const body = (await res.json()) as {
        insights?: CoachInsight[]
        insufficientData?: boolean
        message?: string
      }
      if (body.insufficientData || !(body.insights?.length)) {
        setInsights([])
        setInsufficient(true)
        setMessage(body.message ?? INSUFFICIENT)
        return
      }
      setInsights(body.insights)
      setInsufficient(false)
      setMessage(null)
    } catch {
      setInsights(local.insights)
      setInsufficient(local.insufficient)
      setMessage(local.message)
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
    const id = window.setInterval(tick, 4_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
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

    const q = ask.trim() || 'What should I focus on?'
    const localDna = state.wallet === wallet ? state.dna : null

    if (localDna && localDna.sampleSize >= 3) {
      if (q.length > 20) orch.teach(q)
      void fetch('/api/terminal-os/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          question: q,
          dna: {
            sampleSize: localDna.sampleSize,
            confidence: localDna.confidence,
            tradingStyleSummary: localDna.tradingStyleSummary,
            riskAppetiteLabel: localDna.riskAppetiteLabel,
            winRatePct: localDna.winRatePct,
          },
        }),
      })
      const opp = state.currentOpportunity
      const narrative = opp ? explainDecision(opp) : null
      setAnswer(
        [
          `Context: ${localDna.tradingStyleSummary} (confidence ${localDna.confidence}%).`,
          narrative
            ? `Live opportunity: ${narrative.headline} — ${narrativeBlurb(narrative)}`
            : 'No live opportunity scored yet — activate AI Trading and refresh the desk.',
          `Risk band: ${localDna.riskAppetiteLabel}. Sample size ${localDna.sampleSize}.`,
          `You asked: “${q.slice(0, 160)}”`,
        ].join(' '),
      )
      await load()
      return
    }

    const res = await fetch('/api/terminal-os/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, question: q }),
    })
    const body = (await res.json()) as { answer?: string; insufficientData?: boolean }
    setAnswer(body.answer ?? INSUFFICIENT)
    await load()
  }

  const top = insights?.[0]

  return (
    <Panel
      title="AI Coaching"
      action={<span className="tos-beta-chip">LIVE</span>}
    >
      {insights == null ? (
        <PanelSkeleton rows={2} />
      ) : insufficient || !top ? (
        <EmptyState message={message ?? INSUFFICIENT} />
      ) : (
        <div>
          <div className="tos-row" style={{ marginBottom: 'var(--tos-space-2)' }}>
            <div className="tos-coach-avatar">C</div>
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
