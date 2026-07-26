/**
 * GET /api/agents/activity — Team Activity Feed from agent_activity (real rows only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { listAgentActivity } from '@/lib/agents/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') || '40')
  const rows = await listAgentActivity(Number.isFinite(limit) ? limit : 40)
  return NextResponse.json({
    activity: rows,
    fetchedAt: new Date().toISOString(),
  })
}
