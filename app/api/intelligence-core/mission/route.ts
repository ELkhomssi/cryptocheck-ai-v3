/**
 * GET /api/intelligence-core/mission
 * Prefer SIWS session → userId; wallet for portfolio on-chain reads.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assembleMissionViewModel } from '@/lib/intelligence-core/mission-engine'
import { resolveIdentityWithLookup } from '@/lib/identity/resolve'
import { enforceIdentityRateLimit } from '@/lib/identity/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const identity = await resolveIdentityWithLookup(req)
  const limited = await enforceIdentityRateLimit({
    userId: identity.userId,
    walletAddress: identity.walletAddress,
    route: 'mission',
  })
  if (limited.ok === false) return limited.response

  try {
    const view = await assembleMissionViewModel({
      walletAddress: identity.walletAddress,
      userId: identity.userId,
    })
    return NextResponse.json(view)
  } catch (e) {
    console.error('[intelligence-core/mission]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'mission assemble failed' },
      { status: 500 },
    )
  }
}
