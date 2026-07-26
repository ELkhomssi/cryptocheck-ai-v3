/**
 * GET /api/market/ohlcv?mint=&type=15m&hours=48
 * Real Birdeye candles only — empty when unavailable (never fabricated).
 * ~80–250ms estimated (cached ~60s in provider).
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchOhlcv } from '@/lib/providers/birdeye'
import { isValidSolanaAddress } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const TYPES = new Set(['1m', '3m', '5m', '15m', '30m', '1H', '2H', '4H', '6H', '8H', '12H', '1D', '3D', '1W', '1M'])

export async function GET(req: NextRequest) {
  const t0 = Date.now()
  const mint = (req.nextUrl.searchParams.get('mint') || '').trim()
  const typeRaw = (req.nextUrl.searchParams.get('type') || '15m').trim()
  const type = TYPES.has(typeRaw) ? typeRaw : '15m'
  const hours = Math.min(
    168,
    Math.max(1, Math.floor(Number(req.nextUrl.searchParams.get('hours') || 48) || 48)),
  )

  if (!mint || !isValidSolanaAddress(mint)) {
    return NextResponse.json({ error: 'Invalid mint address' }, { status: 400 })
  }

  const time_to = Math.floor(Date.now() / 1000)
  const time_from = time_to - hours * 3600
  // ~80–250ms estimated
  const candles = await fetchOhlcv(mint, type, time_from, time_to)

  return NextResponse.json({
    mint,
    type,
    candles,
    available: candles.length > 0,
    latencyMs: Date.now() - t0,
  })
}
