import { NextRequest, NextResponse } from 'next/server'
import { runLaunchOpsMonitor } from '@/lib/launch/ops-monitor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET/POST /api/cron/launch-ops
 * Sync migration lanes + alert on Migrate stalls / prepare velocity (deduped).
 * Auth: Bearer CRON_SECRET
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runLaunchOpsMonitor()
    return NextResponse.json(
      {
        ok: true,
        ...result,
        ts: new Date().toISOString(),
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
