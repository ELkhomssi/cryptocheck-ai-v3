/**
 * GET /api/portfolio/analytics?wallet=
 * FIFO cost basis + allocation / risk / correlation analytics.
 * ~300–1500ms estimated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isValidSolanaWallet } from '@/lib/portfolio-desk/validate'
import { buildPortfolioAnalytics } from '@/lib/terminal/portfolio-analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const wallet = (req.nextUrl.searchParams.get('wallet') || '').trim()
  if (!isValidSolanaWallet(wallet)) {
    return NextResponse.json({ error: 'Valid wallet query required' }, { status: 400 })
  }

  try {
    const analytics = await buildPortfolioAnalytics(wallet)
    return NextResponse.json(analytics)
  } catch (err) {
    console.error('[portfolio/analytics]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analytics failed' },
      { status: 502 },
    )
  }
}
