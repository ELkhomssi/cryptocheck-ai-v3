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
 * Never 500s on Redis/provider faults — returns empty with degraded flag.
 */
export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 12) || 12))
    const token = req.nextUrl.searchParams.get('token')?.trim()
    const refresh = req.nextUrl.searchParams.get('refresh') === '1'
    const wantHistory = req.nextUrl.searchParams.get('history') === '1'
    const wallet = req.nextUrl.searchParams.get('wallet')?.trim()

    if (refresh) {
      try {
        await runDecisionTick({ wallet, limit })
      } catch (e) {
        console.error('[terminal-os/decisions] refresh tick failed', e)
      }
    }

    if (token) {
      let decision = await getDecisionByTokenId(token)
      if (!decision && refresh === false) {
        try {
          await runDecisionTick({ wallet, limit })
          decision = await getDecisionByTokenId(token)
        } catch (e) {
          console.error('[terminal-os/decisions] cold-start tick failed', e)
        }
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
      try {
        const tick = await runDecisionTick({ wallet, limit })
        decisions = tick.decisions
      } catch (e) {
        console.error('[terminal-os/decisions] list tick failed', e)
        decisions = []
      }
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
  } catch (e) {
    console.error('[terminal-os/decisions]', e)
    return NextResponse.json(
      {
        decisions: [],
        count: 0,
        tickMeta: null,
        at: new Date().toISOString(),
        degraded: true,
      },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    )
  }
}
