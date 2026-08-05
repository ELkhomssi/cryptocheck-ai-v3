import { NextRequest, NextResponse } from 'next/server'
import { captureWalletTradesForDna } from '@/lib/terminal-os/capture-wallet-trades'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/terminal-os/trade-history?wallet=
 * Real Helius enhanced-tx fills → CapturedTrade (entry/exit/hold/PnL when closed).
 * Never returns signature-only UNK/$0 stubs.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!isValidSolanaMint(wallet)) {
    return NextResponse.json({ error: 'Valid Solana wallet required' }, { status: 400 })
  }

  try {
    const { trades, meta } = await captureWalletTradesForDna(wallet)
    return NextResponse.json(
      {
        trades,
        count: trades.length,
        source: meta.source,
        meta,
      },
      {
        status: meta.source === 'unavailable' ? 503 : 200,
        headers: { 'cache-control': 'no-store' },
      },
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Trade history failed', trades: [], meta: { insufficient: true } },
      { status: 500 },
    )
  }
}
