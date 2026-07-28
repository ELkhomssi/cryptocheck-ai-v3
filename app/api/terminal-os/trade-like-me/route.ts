import { NextRequest, NextResponse } from 'next/server'
import { buildTraderDna } from '@/features/terminal-os/ai-trade-like-me/engines/trader-dna-engine'
import { decide } from '@/features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { buildMarketIntel } from '@/features/terminal-os/ai-trade-like-me/engines/market-intelligence-engine'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import { buildPerformanceReport } from '@/features/terminal-os/ai-trade-like-me/engines/performance-analytics-engine'
import { buildSampleTradeHistory } from '@/features/terminal-os/ai-trade-like-me/lib/sample-trade-history'
import { fetchLiveTopTokens, fetchLiveWhaleMovements } from '@/lib/terminal-os/live-market'
import type { CapturedTrade } from '@/features/terminal-os/ai-trade-like-me/types'
import type { ChainId } from '@/features/terminal-os/shared/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/terminal-os/trade-like-me?action=dna|opportunity|status
 * Server-side evaluation — UI stays thin.
 */
export async function GET(req: NextRequest) {
  const action = (req.nextUrl.searchParams.get('action') || 'status').toLowerCase()
  const wallet = req.nextUrl.searchParams.get('wallet') || 'DemoWhale1111111111111111111111111111111'
  const chain = (req.nextUrl.searchParams.get('chain') || 'solana') as ChainId

  try {
    // Until wallet indexing lands, seed with tagged sample history for DNA demos.
    const trades: CapturedTrade[] = buildSampleTradeHistory(wallet)

    if (action === 'status') {
      const dna = buildTraderDna(wallet, trades)
      return NextResponse.json({
        phase: 'ready',
        learningProgressPct: 100,
        dna,
        performance: buildPerformanceReport(trades, dna),
        autonomy: {
          armed: false,
          blockedReason: 'Autonomous Mode flagged OFF — advise-only',
          wouldExecute: false,
        },
        statusLine: 'Watching Markets…',
        sample: true,
      })
    }

    if (action === 'dna') {
      const dna = buildTraderDna(wallet, trades)
      return NextResponse.json({ dna, tradeCount: trades.length, sample: true })
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
      const dna = buildTraderDna(wallet, trades)
      const intel = buildMarketIntel({ token, whales })
      const decision = decide(dna, intel)
      const narrative = explainDecision(decision)
      return NextResponse.json({
        decision,
        narrative,
        intel,
        dnaSummary: {
          style: dna.tradingStyleSummary,
          confidence: dna.confidenceScore,
          winRate: dna.winRatePct,
        },
        sampleDna: true,
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
