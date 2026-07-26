/**
 * GET|POST /api/cron/intelligence-score
 * Auth: Bearer CRON_SECRET
 * Hourly: probe providers → recompute Intelligence Scores → write snapshots.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  probeAndRecordProviders,
  recomputeAllIntelligenceScores,
} from '@/lib/intelligence/score'

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
    const probes = await probeAndRecordProviders()
    const { modules } = await recomputeAllIntelligenceScores()
    return NextResponse.json({
      ok: true,
      probes,
      modules: modules.map((m) => ({
        id: m.moduleId,
        score: m.score,
        calibrating: m.calibrating,
        reason: m.calibratingReason,
      })),
      at: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'intelligence-score failed' },
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
