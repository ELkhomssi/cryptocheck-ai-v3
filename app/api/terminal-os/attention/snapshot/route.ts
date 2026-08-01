import { NextRequest, NextResponse } from 'next/server'
import { getAttentionSnapshot } from '@/lib/terminal-os/attention-store'
import { runAttentionTick } from '@/lib/terminal-os/attention-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/terminal-os/attention/snapshot?wallet=
 * First paint — precomputed live state (no client spinner).
 * If Redis empty, runs one server tick (engines already warm via resilient cache).
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() || null
  try {
    let snap = await getAttentionSnapshot()
    if (!snap || snap.items.length === 0) {
      const tick = await runAttentionTick({ wallet })
      snap = tick.snapshot
    } else if (wallet) {
      // Merge wallet portfolio without fabricating market events
      const tick = await runAttentionTick({ wallet })
      snap = tick.snapshot
    }
    return NextResponse.json({
      items: snap.items,
      seq: snap.seq,
      updatedAt: snap.updatedAt,
      events: snap.events,
    })
  } catch (e) {
    return NextResponse.json(
      {
        items: [],
        seq: 0,
        updatedAt: new Date().toISOString(),
        events: [],
        error: e instanceof Error ? e.message : 'snapshot failed',
      },
      { status: 200 },
    )
  }
}
