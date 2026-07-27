/**
 * GET /api/intelligence-core/context?kind=trading|coach
 * Session wallet preferred; memory keyed by stable userId.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCoachContext, getTradingContext } from '@/lib/intelligence-core/context-engine'
import { resolveIdentityWithLookup } from '@/lib/identity/resolve'
import { enforceIdentityRateLimit } from '@/lib/identity/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const identity = await resolveIdentityWithLookup(req)
  const wallet = identity.walletAddress
  if (!wallet || wallet.length < 32) {
    return NextResponse.json({ error: 'wallet required — connect and sign in' }, { status: 400 })
  }
  const limited = await enforceIdentityRateLimit({
    userId: identity.userId,
    walletAddress: wallet,
    route: 'context',
  })
  if (limited.ok === false) return limited.response

  const kind = (req.nextUrl.searchParams.get('kind') || 'trading').trim()
  try {
    if (kind === 'coach') {
      const ctx = await getCoachContext(identity.userId || wallet, wallet)
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
