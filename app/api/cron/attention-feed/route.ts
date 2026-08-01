import { NextRequest, NextResponse } from 'next/server'
import { runAttentionTick } from '@/lib/terminal-os/attention-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET|POST /api/cron/attention-feed
 * Auth: Bearer CRON_SECRET
 * Continuously evaluates market/whale/security → Attention Feed Redis.
 * Runs whether or not any browser tab is open.
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAttentionTick()
    return NextResponse.json({
      ok: true,
      changed: result.changed,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
      seq: result.snapshot.seq,
      itemCount: result.snapshot.items.length,
      at: result.snapshot.updatedAt,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'attention tick failed' },
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
