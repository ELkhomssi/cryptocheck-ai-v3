import { NextRequest, NextResponse } from 'next/server'
import { getTradeLikeMeOrchestrator } from '@/features/terminal-os/ai-trade-like-me/engines/orchestrator'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import type { CoachInsight } from '@/features/terminal-os/shared/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const INSUFFICIENT =
  'Not enough data yet — connect and make a few trades, or use Pause & Teach to describe your strategy.'

type DnaHint = {
  sampleSize?: number
  confidence?: number
  tradingStyleSummary?: string
  riskAppetiteLabel?: string
  winRatePct?: number
}

function narrativeBlurb(d: ReturnType<typeof explainDecision>): string {
  return [d.confidenceLine, d.upsideLine, d.downsideLine, ...d.bullets.slice(0, 2)].join(' · ')
}

/**
 * GET /api/terminal-os/coach?wallet=
 * Prefer client-side AiCoachingCard (shares TLM orchestrator DNA).
 * This route reflects the in-process server orchestrator when hydrated.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!wallet) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 })
  }

  const orch = getTradeLikeMeOrchestrator()
  const state = orch.getState({
    autonomousTrading: false,
    copyTrading: false,
    realSwapExecution: false,
  })

  if (!state.wallet || state.wallet !== wallet || !state.dna || state.dna.sampleSize < 3) {
    return NextResponse.json({
      insights: [] as CoachInsight[],
      insufficientData: true,
      message: INSUFFICIENT,
      sampleSize: state.dna?.sampleSize ?? 0,
      learningProgressPct: state.learningProgressPct,
    })
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

  return NextResponse.json({
    insights,
    insufficientData: false,
    sampleSize: dna.sampleSize,
    learningProgressPct: state.learningProgressPct,
    dna: {
      tradingStyleSummary: dna.tradingStyleSummary,
      confidence: dna.confidence,
      riskAppetiteLabel: dna.riskAppetiteLabel,
    },
  })
}

/**
 * POST /api/terminal-os/coach — ask coach with optional client DNA hint.
 * When DNA hint has sampleSize ≥ 3, answers without requiring server-side training.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    wallet?: string
    question?: string
    dna?: DnaHint
  }
  const wallet = body.wallet?.trim() ?? ''
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 })

  const orch = getTradeLikeMeOrchestrator()
  const state = orch.getState({
    autonomousTrading: false,
    copyTrading: false,
    realSwapExecution: false,
  })

  const hint = body.dna
  const hasHint = typeof hint?.sampleSize === 'number' && hint.sampleSize >= 3
  const hasServerDna =
    state.wallet === wallet && state.dna != null && state.dna.sampleSize >= 3

  if (!hasHint && !hasServerDna) {
    return NextResponse.json({
      answer: INSUFFICIENT,
      insufficientData: true,
    })
  }

  const q = (body.question ?? '').trim() || 'What should I focus on?'
  if (hasServerDna && (q.toLowerCase().includes('teach') || q.length > 20)) {
    orch.teach(q)
  }

  const dna = state.dna
  const style =
    hint?.tradingStyleSummary ?? dna?.tradingStyleSummary ?? 'Emerging trader profile'
  const confidence = hint?.confidence ?? dna?.confidence ?? 0
  const risk = hint?.riskAppetiteLabel ?? dna?.riskAppetiteLabel ?? 'moderate'
  const sample = hint?.sampleSize ?? dna?.sampleSize ?? 0
  const opp = state.currentOpportunity
  const narrative = opp ? explainDecision(opp) : null

  const answer = [
    `Context: ${style} (confidence ${confidence}%).`,
    narrative
      ? `Live opportunity: ${narrative.headline} — ${narrativeBlurb(narrative)}`
      : 'No live opportunity scored yet — refresh Trade Like Me desk.',
    `Risk band: ${risk}. Sample size ${sample}.`,
    `You asked: “${q.slice(0, 160)}”`,
  ].join(' ')

  return NextResponse.json({
    answer,
    insufficientData: false,
    confidence,
    sampleSize: sample,
  })
}
