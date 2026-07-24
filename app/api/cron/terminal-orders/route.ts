import { NextRequest, NextResponse } from 'next/server'
import { processTerminalOrders } from '@/lib/terminal/orders-cron'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET|POST /api/cron/terminal-orders
 * Auth: Bearer CRON_SECRET
 *
 * Checks pending limit/DCA/TP/SL orders against Birdeye (or skips when price
 * unavailable). Marks trigger_hit when condition is met — does NOT execute
 * swaps. User must sign Jupiter execution; status=filled only with signature.
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await processTerminalOrders(50)
    return NextResponse.json({
      ok: true,
      ...result,
      note: 'trigger_hit awaits user wallet signature; never auto-fills',
      at: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'orders cron failed' },
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
