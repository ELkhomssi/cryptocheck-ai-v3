import { NextRequest, NextResponse } from 'next/server'
import { listRecentDecisions, getDecisionByTokenId } from '@/lib/terminal-os/decision-store'
import { runDecisionTick } from '@/lib/terminal-os/decision-engine-tick'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/terminal-os/decisions?limit=&token=
 * Read-only Layer 4 access to server-persisted Decisions.
 * Optional refresh=1 forces a tick (manual recompute — does not replace cron).
 */
export async function GET(req: NextRequest) {
  const limit = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 12) || 12))
  const token = req.nextUrl.searchParams.get('token')?.trim()
  const refresh = req.nextUrl.searchParams.get('refresh') === '1'
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim()

  if (refresh) {
    await runDecisionTick({ wallet, limit })
  }

  if (token) {
    let decision = await getDecisionByTokenId(token)
    if (!decision && refresh === false) {
      // Cold start — one tick so Discovery is never permanently empty
      await runDecisionTick({ wallet, limit })
      decision = await getDecisionByTokenId(token)
    }
    return NextResponse.json(
      { decision, at: new Date().toISOString() },
      { headers: { 'cache-control': 'no-store' } },
    )
  }

  let decisions = await listRecentDecisions(limit)
  if (!decisions.length) {
    const tick = await runDecisionTick({ wallet, limit })
    decisions = tick.decisions
  }

  return NextResponse.json(
    {
      decisions,
      count: decisions.length,
      at: new Date().toISOString(),
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
