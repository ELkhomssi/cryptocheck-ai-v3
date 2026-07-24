/**
 * GET /api/market/token?mint=
 * Single-token live metrics via Birdeye overview + terminal scoring.
 * ~50–200ms estimated (cached overview TTL ~15s).
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchTokenMarket } from '@/lib/providers/birdeye'
import type { ScreenerRow } from '@/lib/providers/types'
import {
  computeAiScore,
  computeRiskScore,
  computeSmartMoneyScore,
} from '@/lib/terminal/scoring'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const t0 = Date.now()
  const mint = (req.nextUrl.searchParams.get('mint') || '').trim()

  if (!mint || !isValidSolanaMint(mint)) {
    return NextResponse.json({ error: 'Invalid mint address' }, { status: 400 })
  }

  const overview = await fetchTokenMarket(mint)
  if (!overview) {
    return NextResponse.json(
      {
        mint,
        available: false,
        error: 'Token market data unavailable',
        latencyMs: Date.now() - t0,
      },
      { status: 502 },
    )
  }

  const row: ScreenerRow = {
    ...overview,
    riskScore: 0,
    aiScore: 0,
    isPumpFun: false,
    isRaydium: false,
    isGraduated: false,
    isVerified: false,
    isTrending: false,
    smartMoneyScore: 0,
  }
  row.riskScore = computeRiskScore(row)
  row.aiScore = computeAiScore(row)
  row.smartMoneyScore = computeSmartMoneyScore(row)

  return NextResponse.json({
    token: row,
    available: true,
    latencyMs: Date.now() - t0,
  })
}
