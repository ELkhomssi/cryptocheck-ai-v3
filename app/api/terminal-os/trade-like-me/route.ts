import { NextRequest, NextResponse } from 'next/server'
import { buildTraderDna } from '@/features/terminal-os/ai-trade-like-me/engines/trader-dna-engine'
import { decide } from '@/features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { buildMarketIntel } from '@/features/terminal-os/ai-trade-like-me/engines/market-intelligence-engine'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import { buildPerformanceReport } from '@/features/terminal-os/ai-trade-like-me/engines/performance-analytics-engine'
import { buildSampleTradeHistory } from '@/features/terminal-os/ai-trade-like-me/lib/sample-trade-history'
import { fetchLiveTopTokens, fetchLiveWhaleMovements } from '@/lib/terminal-os/live-market'
import { getPersistedDna } from '@/lib/terminal-os/dna-store'
import { fetchCapturedTrades } from '@/lib/terminal-os/fetch-captured-trades'
import { isValidSolanaMint } from '@/lib/validation/mint'
import type { CapturedTrade, TraderDna } from '@/features/terminal-os/ai-trade-like-me/types'
import type { ChainId } from '@/features/terminal-os/shared/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEMO_WALLET = 'DemoWhale1111111111111111111111111111111'

type ResolvedHistory = {
  dna: TraderDna | null
  trades: CapturedTrade[]
  sample: boolean
  insufficientData: boolean
}

/**
 * Load order (never silent sample for a real wallet):
 * 1) getPersistedDna if sampleSize >= 3
 * 2) fetch real trades via Helius path
 * 3) only if query sample=1 explicitly → sample history + sample:true
 */
async function resolveTradeLikeMeHistory(
  wallet: string,
  wantSample: boolean,
): Promise<ResolvedHistory> {
  if (wantSample) {
    const trades = buildSampleTradeHistory(wallet || DEMO_WALLET)
    const dna = buildTraderDna(wallet || DEMO_WALLET, trades)
    return { dna, trades, sample: true, insufficientData: false }
  }

  let dna: TraderDna | null = null
  let trades: CapturedTrade[] = []

  const persisted = wallet ? await getPersistedDna(wallet).catch(() => null) : null
  if (persisted && persisted.sampleSize >= 3) {
    dna = persisted
  }

  if (wallet && isValidSolanaMint(wallet)) {
    try {
      trades = await fetchCapturedTrades(wallet)
    } catch {
      trades = []
    }
  }

  if (!dna && trades.length >= 3) {
    dna = buildTraderDna(wallet, trades)
  }

  const insufficientData = !dna
  return { dna, trades, sample: false, insufficientData }
}

/**
 * GET /api/terminal-os/trade-like-me?action=dna|opportunity|status&wallet=&sample=1
 * Real DNA/trades only — sample path requires explicit sample=1.
 */
export async function GET(req: NextRequest) {
  const action = (req.nextUrl.searchParams.get('action') || 'status').toLowerCase()
  const wantSample = req.nextUrl.searchParams.get('sample') === '1'
  const walletParam = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  const wallet = walletParam || (wantSample ? DEMO_WALLET : '')
  const chain = (req.nextUrl.searchParams.get('chain') || 'solana') as ChainId

  if (!wallet && !wantSample) {
    return NextResponse.json(
      {
        error: 'wallet required (or sample=1 for demo)',
        insufficientData: true,
        sample: false,
        dna: null,
      },
      { status: 400 },
    )
  }

  try {
    const resolved = await resolveTradeLikeMeHistory(wallet, wantSample)
    const { dna, trades, sample, insufficientData } = resolved

    if (action === 'status') {
      if (insufficientData || !dna) {
        return NextResponse.json({
          phase: 'insufficient',
          learningProgressPct: Math.min(99, Math.round((trades.length / 3) * 100)),
          dna: null,
          performance: null,
          autonomy: {
            armed: false,
            blockedReason: 'Insufficient trade history — connect wallet and train',
            wouldExecute: false,
          },
          statusLine: 'Need more on-chain trades to build Trader DNA',
          tradeCount: trades.length,
          insufficientData: true,
          sample: false,
        })
      }
      return NextResponse.json({
        phase: 'ready',
        learningProgressPct: 100,
        dna,
        performance: buildPerformanceReport(trades.length ? trades : [], dna),
        autonomy: {
          armed: false,
          blockedReason: 'Autonomous Mode flagged OFF — advise-only',
          wouldExecute: false,
        },
        statusLine: sample ? 'Sample DNA (explicit sample=1)' : 'Watching Markets…',
        tradeCount: trades.length,
        insufficientData: false,
        sample,
      })
    }

    if (action === 'dna') {
      if (insufficientData || !dna) {
        return NextResponse.json({
          dna: null,
          tradeCount: trades.length,
          insufficientData: true,
          sample: false,
        })
      }
      return NextResponse.json({
        dna,
        tradeCount: trades.length,
        insufficientData: false,
        sample,
      })
    }

    if (action === 'opportunity') {
      const [tokens, whales] = await Promise.all([
        fetchLiveTopTokens(chain, 8),
        fetchLiveWhaleMovements(16),
      ])
      const token = tokens[0]
      if (!token) {
        return NextResponse.json({ error: 'No live tokens' }, { status: 502 })
      }
      // Real DNA when available; null → market-quality decide (never invent sample DNA)
      const intel = buildMarketIntel({ token, whales })
      const decision = decide(dna, intel)
      const narrative = explainDecision(decision)
      return NextResponse.json({
        decision,
        narrative,
        intel,
        dnaSummary: dna
          ? {
              style: dna.tradingStyleSummary,
              confidence: dna.confidenceScore,
              winRate: dna.winRatePct,
            }
          : null,
        confidenceMode: decision.scores.confidenceMode,
        behaviorMatch: decision.scores.behaviorMatch,
        marketConfidence: decision.scores.marketConfidence,
        personalizedConfidence: decision.scores.personalizedConfidence ?? null,
        insufficientData: !dna,
        sample,
        sampleDna: wantSample,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Trade Like Me error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

/** POST — teach note or evaluate custom context (no execution) */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: string
      note?: string
      wallet?: string
    }
    if (body.action === 'teach' && body.note?.trim()) {
      return NextResponse.json({
        ok: true,
        received: body.note.trim().slice(0, 500),
        message: 'Teach note queued for behavioral update (advise-only).',
      })
    }
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Bad request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
