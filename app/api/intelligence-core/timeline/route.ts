/**
 * GET /api/intelligence-core/timeline
 * Unified timeline_events feed (DB-trigger populated).
 */

import { NextRequest, NextResponse } from 'next/server'
import { listTimelineEvents } from '@/lib/intelligence-core/timeline-engine'
import { resolveIdentityWithLookup } from '@/lib/identity/resolve'
import { enforceIdentityRateLimit } from '@/lib/identity/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const identity = await resolveIdentityWithLookup(req)
  const limited = await enforceIdentityRateLimit({
    userId: identity.userId,
    walletAddress: identity.walletAddress,
    route: 'timeline',
  })
  if (!limited.ok) return limited.response

  const limit = Number(req.nextUrl.searchParams.get('limit') || '40')
  const module = req.nextUrl.searchParams.get('module')
  const ownerKeys = [identity.userId, identity.walletAddress].filter(
    (k): k is string => Boolean(k && k.trim()),
  )
  // Tenant isolation: authenticated users only see their own timeline rows.
  if (identity.authenticated && ownerKeys.length === 0) {
    return NextResponse.json({ events: [], fetchedAt: new Date().toISOString() })
  }
  try {
    const events = await listTimelineEvents({
      limit: Number.isFinite(limit) ? limit : 40,
      module: module || null,
      ownerKeys: ownerKeys.length ? ownerKeys : null,
    })
    return NextResponse.json({ events, fetchedAt: new Date().toISOString() })
  } catch (e) {
    console.error('[intelligence-core/timeline]', e)
    return NextResponse.json({ events: [], error: 'timeline unavailable' }, { status: 500 })
  }
}
