/**
 * GET /api/intelligence-core/context/trading?wallet=
 * GET /api/intelligence-core/context/coach?wallet=
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCoachContext, getTradingContext } from '@/lib/intelligence-core/context-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const wallet = (req.nextUrl.searchParams.get('wallet') || '').trim()
  const kind = (req.nextUrl.searchParams.get('kind') || 'trading').trim()
  if (!wallet || wallet.length < 32) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 })
  }
  try {
    if (kind === 'coach') {
      const ctx = await getCoachContext(wallet)
      return NextResponse.json(ctx)
    }
    const ctx = await getTradingContext(wallet)
    return NextResponse.json(ctx)
  } catch (e) {
    console.error('[intelligence-core/context]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'context failed' },
      { status: 500 },
    )
  }
}
