import { NextRequest, NextResponse } from 'next/server'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import { isValidSolanaWallet } from '@/lib/portfolio-desk/validate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/portfolio/holdings?wallet=… — Helius balances + Jupiter prices. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!isValidSolanaWallet(wallet)) {
    return NextResponse.json({ error: 'wallet query param required' }, { status: 400 })
  }
  try {
    const data = await buildHoldingsResponse(wallet)
    return NextResponse.json(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Holdings unavailable'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
