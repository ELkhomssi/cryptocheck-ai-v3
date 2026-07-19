import { NextResponse } from 'next/server'
import { getLaunchOpsSummary } from '@/lib/launch/ops-monitor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/launch/ops-summary
 * Operator tile: launches today, migrations today, pause flag.
 * Auth: Bearer CRON_SECRET | LAUNCH_CONTROL_SECRET | LAUNCH_MIGRATION_SYNC_SECRET
 */
export async function GET(req: Request) {
  const secret =
    process.env.LAUNCH_CONTROL_SECRET?.trim() ||
    process.env.LAUNCH_MIGRATION_SYNC_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? ''
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const summary = await getLaunchOpsSummary()
    return NextResponse.json(
      { ok: true, ...summary, ts: new Date().toISOString() },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
