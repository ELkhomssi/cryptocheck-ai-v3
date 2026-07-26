/**
 * GET /api/agents/activity — Team Activity Feed from agent_activity (real rows only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { listAgentActivity } from '@/lib/agents/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') || '40')
  const status = (req.nextUrl.searchParams.get('status') || '').trim()
  let rows = await listAgentActivity(Number.isFinite(limit) ? limit : 40)
  if (status === 'running' || status === 'completed' || status === 'failed') {
    rows = rows.filter((r) => r.status === status)
  }
  return NextResponse.json({
    activity: rows,
    fetchedAt: new Date().toISOString(),
  })
}
