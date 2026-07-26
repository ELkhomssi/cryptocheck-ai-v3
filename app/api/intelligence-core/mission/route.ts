/**
 * GET /api/intelligence-core/mission?wallet=
 * Mission Control view model via MissionEngine.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assembleMissionViewModel } from '@/lib/intelligence-core/mission-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const wallet = (req.nextUrl.searchParams.get('wallet') || '').trim() || null
  try {
    const view = await assembleMissionViewModel({ walletAddress: wallet })
    return NextResponse.json(view)
  } catch (e) {
    console.error('[intelligence-core/mission]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'mission assemble failed' },
      { status: 500 },
    )
  }
}
