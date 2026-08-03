import { NextRequest, NextResponse } from 'next/server'
import { getTradeLikeMeOrchestrator } from '@/features/terminal-os/ai-trade-like-me/engines/orchestrator'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import { getPersistedDna } from '@/lib/terminal-os/dna-store'
import type { CoachInsight } from '@/features/terminal-os/shared/types'
import type { TraderDna } from '@/features/terminal-os/ai-trade-like-me/types'
import { learningProgressFromSampleSize } from '@/features/terminal-os/ai-trade-like-me/engines/behavioral-learning-engine'

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

function insightsFromDna(
  dna: TraderDna,
  oppSummary?: ReturnType<typeof explainDecision> | null,
  oppAction?: string | null,
  oppConfidence?: number | null,
): CoachInsight[] {
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
  if (oppSummary) {
    const conf = oppConfidence ?? dna.confidence
    insights.push({
      id: `opp-${dna.wallet.slice(0, 6)}`,
      headline: oppSummary.headline,
      reasoning: narrativeBlurb(oppSummary).slice(0, 280),
      statistic: oppSummary.confidenceLine,
      expectedImpact: `${oppSummary.upsideLine} · ${oppSummary.downsideLine}`,
      confidence: Math.round(conf),
    })
    insights.push({
      id: `discipline-${dna.sampleSize}`,
      headline: oppAction
        ? `Decision ${oppAction} · Coach mirrors Decision Engine (no independent score)`
        : 'Awaiting Decision — no independent Coach prescription',
      reasoning:
        dna.emotionalBiasScore > 55
          ? `DNA emotionalBiasScore ${dna.emotionalBiasScore}/100 (fact). Action comes from Decision only.`
          : `DNA sample ${dna.sampleSize} · win ${dna.winRatePct.toFixed(1)}% (facts).`,
      statistic: `Decision conf ${Math.round(conf)}% · DNA conf ${dna.confidence}%`,
      expectedImpact: oppSummary.confidenceLine,
      confidence: Math.round(conf),
    })
  }
  return insights
}

/**
 * GET /api/terminal-os/coach?wallet=
 * Uses in-process orchestrator DNA, then falls back to Redis-persisted DNA.
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

  let dna: TraderDna | null =
    state.wallet === wallet && state.dna && state.dna.sampleSize >= 3 ? state.dna : null

  if (!dna) {
    const persisted = await getPersistedDna(wallet)
    if (persisted && persisted.sampleSize >= 3) {
      dna = persisted
      orch.dnaEngine.hydrate(persisted)
    }
  }

  if (!dna || dna.sampleSize < 3) {
    return NextResponse.json({
      insights: [] as CoachInsight[],
      insufficientData: true,
      message: INSUFFICIENT,
      sampleSize: dna?.sampleSize ?? 0,
      learningProgressPct: learningProgressFromSampleSize(dna?.sampleSize ?? 0),
    })
  }

  const oppNarrative = state.currentOpportunity ? explainDecision(state.currentOpportunity) : null

  return NextResponse.json({
    insights: insightsFromDna(
      dna,
      oppNarrative,
      state.currentOpportunity?.action ?? null,
      state.currentOpportunity?.scores.confidence ?? null,
    ),
    insufficientData: false,
    sampleSize: dna.sampleSize,
    learningProgressPct: learningProgressFromSampleSize(dna.sampleSize),
    dna: {
      tradingStyleSummary: dna.tradingStyleSummary,
      confidence: dna.confidence,
      riskAppetiteLabel: dna.riskAppetiteLabel,
    },
  })
}

/**
 * POST /api/terminal-os/coach — ask coach with optional client DNA hint + Redis fallback.
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

  let persisted: TraderDna | null = null
  if (!hasHint && !hasServerDna) {
    persisted = await getPersistedDna(wallet)
  }

  if (!hasHint && !hasServerDna && (!persisted || persisted.sampleSize < 3)) {
    return NextResponse.json({
      answer: INSUFFICIENT,
      insufficientData: true,
    })
  }

  const q = (body.question ?? '').trim() || 'What should I focus on?'
  if (hasServerDna && (q.toLowerCase().includes('teach') || q.length > 20)) {
    orch.teach(q)
  }

  const dna = state.dna ?? persisted
  const style =
    hint?.tradingStyleSummary ??
    dna?.tradingStyleSummary ??
    'Emerging trader profile'
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
