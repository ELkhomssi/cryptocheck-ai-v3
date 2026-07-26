/**
 * GET /api/intelligence-core/timeline
 * Unified timeline_events feed (DB-trigger populated).
 */

import { NextRequest, NextResponse } from 'next/server'
import { listTimelineEvents } from '@/lib/intelligence-core/timeline-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') || '40')
  const module = req.nextUrl.searchParams.get('module')
  try {
    const events = await listTimelineEvents({
      limit: Number.isFinite(limit) ? limit : 40,
      module: module || null,
    })
    return NextResponse.json({ events, fetchedAt: new Date().toISOString() })
  } catch (e) {
    console.error('[intelligence-core/timeline]', e)
    return NextResponse.json({ events: [], error: 'timeline unavailable' }, { status: 500 })
  }
}
