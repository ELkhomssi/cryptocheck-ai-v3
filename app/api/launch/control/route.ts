import { NextResponse } from 'next/server'
import {
  getLaunchControlState,
  setLaunchModePaused,
} from '@/lib/launch/control'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function authorized(req: Request): boolean {
  const secret =
    process.env.LAUNCH_CONTROL_SECRET?.trim() ||
    process.env.LAUNCH_MIGRATION_SYNC_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? ''
  return Boolean(secret) && auth === secret
}

/** GET /api/launch/control — pause + enable status for ops. */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const state = await getLaunchControlState()
  return NextResponse.json({ ok: true, ...state }, { headers: { 'cache-control': 'no-store' } })
}

/**
 * POST /api/launch/control
 * Body: { paused: boolean }
 * Instantly pauses/resumes NEW launches (Redis). Env LAUNCH_MODE_PAUSED also forces pause.
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as { paused?: unknown }
  if (typeof body.paused !== 'boolean') {
    return NextResponse.json({ error: 'paused boolean required' }, { status: 400 })
  }
  const result = await setLaunchModePaused(body.paused)
  const state = await getLaunchControlState()
  return NextResponse.json(
    { ok: true, ...result, ...state },
    { headers: { 'cache-control': 'no-store' } },
  )
}
