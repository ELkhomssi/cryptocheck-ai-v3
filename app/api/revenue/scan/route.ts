import { NextRequest, NextResponse } from 'next/server'
import { assessRiskByMint, gatewayResponseHeaders } from '@/lib/connect/scan-gateway'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { scanResultFromAssessment } from '@/lib/revenue-dashboard/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST /api/revenue/scan — fast gateway scan for Revenue Dashboard UI. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { mint?: string }
  const mint = typeof body.mint === 'string' ? body.mint.trim() : ''
  if (!isValidSolanaMint(mint)) {
    return NextResponse.json(
      { error: 'Valid Solana mint required', code: 'INVALID_MINT' },
      { status: 400, headers: gatewayResponseHeaders() },
    )
  }

  try {
    const assessment = await assessRiskByMint(mint, 'solana', 'fast')
    const result = scanResultFromAssessment(mint, assessment)
    return NextResponse.json(result, { status: 200, headers: gatewayResponseHeaders() })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Scan failed'
    return NextResponse.json(
      { error: message, code: 'SCAN_FAILED' },
      { status: 500, headers: gatewayResponseHeaders() },
    )
  }
}
