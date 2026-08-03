import { NextRequest, NextResponse } from 'next/server'
import { getTradeLikeMeOrchestrator } from '@/features/terminal-os/ai-trade-like-me/engines/orchestrator'
import { getPersistedDna } from '@/lib/terminal-os/dna-store'
import { listRecentDecisions } from '@/lib/terminal-os/decision-store'
import type { Decision } from '@cryptocheck/decision-contracts'
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

function insightFromDecision(d: Decision): CoachInsight {
  const symbol = d.subject.kind === 'token' ? d.subject.symbol : d.subject.address.slice(0, 6)
  const conf =
    d.confidenceMode === 'personalized' && d.personalizedConfidence != null
      ? d.personalizedConfidence
      : d.marketConfidence ?? d.confidence
  return {
    id: d.id,
    headline: `${d.action} $${symbol} · ${d.confidenceMode} conf ${conf}%`,
    reasoning: d.reasoning.slice(0, 280),
    statistic: `Risk ${d.risk} · factors ${d.contributingFactors.length}`,
    expectedImpact:
      d.expectedROI != null
        ? `Est. ROI ${d.expectedROI}% · drawdown ${d.expectedDrawdown ?? '—'}%`
        : d.contributingFactors[0]?.summary ?? 'Server Decision Engine',
    confidence: Math.round(conf),
  }
}

function insightsFromDna(dna: TraderDna, decision?: Decision | null): CoachInsight[] {
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
  if (decision) {
    insights.push(insightFromDecision(decision))
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
  return insights
}

/**
 * GET /api/terminal-os/coach?wallet=
 * DNA from orchestrator/Redis; opportunity insight from shared Decision store.
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

  const decisions = await listRecentDecisions(8).catch(() => [] as Decision[])
  const top =
    decisions.find((d) => d.action === 'BUY' || d.action === 'WAIT' || d.action === 'SELL') ??
    decisions[0] ??
    null

  return NextResponse.json({
    insights: insightsFromDna(dna, top),
    insufficientData: false,
    sampleSize: dna.sampleSize,
    learningProgressPct: learningProgressFromSampleSize(dna.sampleSize),
    decision: top,
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
  const decisions = await listRecentDecisions(8).catch(() => [] as Decision[])
  const top =
    decisions.find((d) => d.action === 'BUY' || d.action === 'WAIT' || d.action === 'SELL') ??
    decisions[0] ??
    null

  const answer = [
    `Context: ${style} (confidence ${confidence}%).`,
    top
      ? `Live Decision: ${top.action} $${top.subject.kind === 'token' ? top.subject.symbol : 'wallet'} · ${top.confidenceMode} conf ${top.marketConfidence ?? top.confidence}% — ${top.reasoning.slice(0, 160)}`
      : 'No live Decision in the shared store yet — waiting for Decision Engine tick.',
    `Risk band: ${risk}. Sample size ${sample}.`,
    `You asked: “${q.slice(0, 160)}”`,
  ].join(' ')

  return NextResponse.json({
    answer,
    insufficientData: false,
    confidence,
    sampleSize: sample,
    decision: top,
  })
}
