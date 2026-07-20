import { NextResponse } from 'next/server'
import { runPersonalWatchTick } from '@/lib/personal-watch/runner'
import { PERSONAL_WATCH_PREMIUM_INTERVAL_SEC } from '@/lib/personal-watch/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * GET/POST /api/cron/personal-watch-premium
 * Premium-tier accelerated rescans (~45s throttle per mint).
 * Auth: Bearer CRON_SECRET
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const q = new URL(req.url).searchParams.get('secret') ?? ''
  if (secret && auth !== secret && q !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runPersonalWatchTick('premium')
    return NextResponse.json({
      ok: true,
      ...result,
      evidence: {
        mode: 'premium',
        targetIntervalSec: PERSONAL_WATCH_PREMIUM_INTERVAL_SEC,
        costModel: 'premium mints only; one scan per unique mint per throttle window',
        timestamp: new Date().toISOString(),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
}

export async function GET(req: Request) {
  return run(req)
}

export async function POST(req: Request) {
  return run(req)
}
