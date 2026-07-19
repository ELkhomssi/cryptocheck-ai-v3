import { NextResponse } from 'next/server'
import { syncLaunchMigrations } from '@/lib/launch/migration-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/launch/migration-sync
 * Operator / cron: poll LaunchpadPool.status and move curve → migrate → migrated.
 * Auth: CRON_SECRET or LAUNCH_MIGRATION_SYNC_SECRET bearer token.
 */
export async function POST(req: Request) {
  const secret =
    process.env.LAUNCH_MIGRATION_SYNC_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? ''
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { limit?: number }
  try {
    const result = await syncLaunchMigrations(body.limit ?? 50)
    return NextResponse.json({ ok: true, ...result }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
