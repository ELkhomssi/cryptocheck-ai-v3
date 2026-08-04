import { NextRequest, NextResponse } from 'next/server'
import {
  listRecentDecisions,
  getDecisionByTokenId,
  getDecisionHistory,
  getDecisionTickMeta,
} from '@/lib/terminal-os/decision-store'
import { runDecisionTick } from '@/lib/terminal-os/decision-engine-tick'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/terminal-os/decisions?limit=&token=&history=1
 * Read-only Layer 4 access to server-persisted Decisions.
 * Optional refresh=1 forces a tick (manual recompute — does not replace cron).
 * Optional history=1 (with token=) adds DecisionHistoryPoint[] via getDecisionHistory.
 */
export async function GET(req: NextRequest) {
  const limit = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 12) || 12))
  const token = req.nextUrl.searchParams.get('token')?.trim()
  const refresh = req.nextUrl.searchParams.get('refresh') === '1'
  const wantHistory = req.nextUrl.searchParams.get('history') === '1'
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
    const history = wantHistory ? await getDecisionHistory(token, 32) : undefined
    const tickMeta = await getDecisionTickMeta()
    return NextResponse.json(
      {
        decision,
        tickMeta,
        ...(wantHistory ? { history } : {}),
        at: new Date().toISOString(),
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  }

  let decisions = await listRecentDecisions(limit)
  if (!decisions.length) {
    const tick = await runDecisionTick({ wallet, limit })
    decisions = tick.decisions
  }

  const tickMeta = await getDecisionTickMeta()
  return NextResponse.json(
    {
      decisions,
      count: decisions.length,
      tickMeta,
      at: new Date().toISOString(),
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
