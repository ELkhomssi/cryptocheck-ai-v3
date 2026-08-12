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

function emptyTickMeta() {
  return null
}

/**
 * GET /api/terminal-os/decisions?limit=&token=&history=1
 * Read-only Layer 4 access to server-persisted Decisions.
 * Optional refresh=1 forces a tick (manual recompute — does not replace cron).
 * Optional history=1 (with token=) adds DecisionHistoryPoint[] via getDecisionHistory.
 *
 * Never returns an empty 500 body — Layer 4 clients parse JSON; failures return
 * honest empty payloads so the Terminal shell can render without crashing.
 */
export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 12) || 12))
    const token = req.nextUrl.searchParams.get('token')?.trim()
    const refresh = req.nextUrl.searchParams.get('refresh') === '1'
    const wantHistory = req.nextUrl.searchParams.get('history') === '1'
    const wallet = req.nextUrl.searchParams.get('wallet')?.trim()

    if (refresh) {
      await runDecisionTick({ wallet, limit }).catch((err) => {
        console.error('[tos/decisions] refresh tick failed', err)
      })
    }

    if (token) {
      let decision = await getDecisionByTokenId(token).catch(() => null)
      if (!decision && refresh === false) {
        // Cold start — one tick so Discovery is never permanently empty
        await runDecisionTick({ wallet, limit }).catch((err) => {
          console.error('[tos/decisions] cold-start tick failed', err)
        })
        decision = await getDecisionByTokenId(token).catch(() => null)
      }
      const history = wantHistory
        ? await getDecisionHistory(token, 32).catch(() => [])
        : undefined
      const tickMeta = await getDecisionTickMeta().catch(() => emptyTickMeta())
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

    let decisions = await listRecentDecisions(limit).catch(() => [])
    let tickError: string | null = null
    if (!decisions.length || refresh) {
      try {
        const tick = await runDecisionTick({ wallet, limit })
        if (tick.decisions.length) decisions = tick.decisions
        if (!tick.decisions.length) {
          tickError = `tick_empty scanned=${tick.computed}`
        }
      } catch (err) {
        tickError = err instanceof Error ? err.message : 'tick_failed'
        console.error('[tos/decisions] list tick failed', err)
      }
    }

    const tickMeta = await getDecisionTickMeta().catch(() => emptyTickMeta())
    return NextResponse.json(
      {
        decisions,
        count: decisions.length,
        tickMeta,
        at: new Date().toISOString(),
        ...(tickError ? { tickError } : {}),
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (err) {
    console.error('[tos/decisions] GET failed', err)
    return NextResponse.json(
      {
        decisions: [],
        decision: null,
        count: 0,
        tickMeta: null,
        at: new Date().toISOString(),
        error: 'decisions_unavailable',
      },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    )
  }
}
