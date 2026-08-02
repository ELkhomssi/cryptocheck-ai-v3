import { NextRequest, NextResponse } from 'next/server'
import { fetchCapturedTrades } from '@/lib/terminal-os/fetch-captured-trades'
import { isValidSolanaMint } from '@/lib/validation/mint'
import type { CapturedTrade } from '@/features/terminal-os/ai-trade-like-me/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/terminal-os/trade-history?wallet=
 * Captures recent on-chain signatures as CapturedTrade seeds (read-only).
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!isValidSolanaMint(wallet)) {
    return NextResponse.json({ error: 'Valid Solana wallet required' }, { status: 400 })
  }

  try {
    const trades = await fetchCapturedTrades(wallet)
    return NextResponse.json(
      { trades, count: trades.length, source: 'rpc_signatures' },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Trade history fetch failed',
        trades: [] as CapturedTrade[],
      },
      { status: 502 },
    )
  }
}
