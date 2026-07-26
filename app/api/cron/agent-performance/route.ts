/**
 * GET|POST /api/cron/agent-performance
 * Auth: Bearer CRON_SECRET
 * Resolves pending agent_predictions and writes agent_performance_snapshots.
 */

import { NextRequest, NextResponse } from 'next/server'
import { recomputeAllPerformanceSnapshots } from '@/lib/agents/performance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await recomputeAllPerformanceSnapshots()
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'recompute failed' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  return run(req)
}

export async function POST(req: NextRequest) {
  return run(req)
}
