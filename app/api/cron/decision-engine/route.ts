import { NextRequest, NextResponse } from 'next/server'
import { runDecisionTick } from '@/lib/terminal-os/decision-engine-tick'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET|POST /api/cron/decision-engine
 * Auth: Bearer CRON_SECRET
 * Continuously computes Decisions for top tokens → Redis.
 * Runs whether or not any browser tab is open.
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDecisionTick()
    return NextResponse.json({
      ok: true,
      computed: result.computed,
      at: result.at,
      sample: result.decisions.slice(0, 3).map((d) => ({
        id: d.id,
        symbol: d.subject.kind === 'token' ? d.subject.symbol : d.subject.address,
        action: d.action,
        confidence: d.confidence,
        marketConfidence: d.marketConfidence,
        mode: d.confidenceMode,
      })),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'decision tick failed' },
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
