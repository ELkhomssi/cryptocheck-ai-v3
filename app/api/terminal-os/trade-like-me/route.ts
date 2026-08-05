import { NextRequest, NextResponse } from 'next/server'
import { buildTraderDna } from '@/features/terminal-os/ai-trade-like-me/engines/trader-dna-engine'
import { decide } from '@/features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { buildMarketIntel } from '@/features/terminal-os/ai-trade-like-me/engines/market-intelligence-engine'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import { buildPerformanceReport } from '@/features/terminal-os/ai-trade-like-me/engines/performance-analytics-engine'
import { captureWalletTradesForDna } from '@/lib/terminal-os/capture-wallet-trades'
import { getPersistedDna, savePersistedDna } from '@/lib/terminal-os/dna-store'
import { fetchLiveTopTokens, fetchLiveWhaleMovements } from '@/lib/terminal-os/live-market'
import type { ChainId } from '@/features/terminal-os/shared/types'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/terminal-os/trade-like-me?action=dna|opportunity|status&wallet=
 * Real Helius fills → DNA. No sample-trade-history in production path.
 */
export async function GET(req: NextRequest) {
  const action = (req.nextUrl.searchParams.get('action') || 'status').toLowerCase()
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() || ''
  const chain = (req.nextUrl.searchParams.get('chain') || 'solana') as ChainId

  if (!wallet || !isValidSolanaMint(wallet)) {
    return NextResponse.json(
      { error: 'Valid Solana wallet required — demo sample DNA path removed' },
      { status: 400 },
    )
  }

  try {
    const capture = await captureWalletTradesForDna(wallet)
    const persisted = await getPersistedDna(wallet)
    const trades = capture.trades
    const dna =
      !capture.meta.insufficient && trades.length
        ? buildTraderDna(wallet, trades)
        : persisted

    if (dna && !capture.meta.insufficient && (dna.avgHoldingMs ?? 0) > 0) {
      await savePersistedDna(dna)
    }

    if (action === 'status') {
      return NextResponse.json({
        phase: dna ? 'ready' : 'awaiting_fills',
        learningProgressPct: dna
          ? Math.min(100, Math.round((dna.sampleSize / 8) * 100))
          : 0,
        dna: dna ?? null,
        performance: dna ? buildPerformanceReport(trades, dna) : null,
        capture: capture.meta,
        autonomy: {
          armed: false,
          blockedReason: 'Autonomous Mode flagged OFF — advise-only',
          wouldExecute: false,
        },
        statusLine: capture.meta.insufficient
          ? capture.meta.reason ?? 'Need closed priced fills'
          : 'Watching Markets…',
        sample: false,
      })
    }

    if (action === 'dna') {
      return NextResponse.json({
        dna: dna ?? null,
        tradeCount: trades.length,
        meta: capture.meta,
        sample: false,
      })
    }

    if (action === 'opportunity') {
      if (!dna || capture.meta.insufficient) {
        return NextResponse.json(
          {
            error: capture.meta.reason ?? 'Insufficient real fills for personalized opportunity',
            meta: capture.meta,
          },
          { status: 422 },
        )
      }
      const [tokens, whales] = await Promise.all([
        fetchLiveTopTokens(chain, 8),
        fetchLiveWhaleMovements(16),
      ])
      const token = tokens[0]
      if (!token) {
        return NextResponse.json({ error: 'No live tokens' }, { status: 502 })
      }
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
        sampleDna: false,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Trade Like Me error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
