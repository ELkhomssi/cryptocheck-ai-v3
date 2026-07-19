import { NextRequest, NextResponse } from 'next/server'
import { dispatchWatchDegradePush } from '@/lib/personal-watch/push'
import type { WatchDegradeEvent } from '@/lib/personal-watch/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function assertWorker(req: NextRequest): boolean {
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() || process.env.CRON_SECRET?.trim() || ''
  return Boolean(secret && header === secret)
}

/**
 * POST /api/internal/watch/push-dispatch
 * Same VAPID pipeline as signals — WatchDegradeEvent payload.
 */
export async function POST(req: NextRequest) {
  if (!assertWorker(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as { event?: WatchDegradeEvent }
  if (!body.event?.id || !body.event.userId || !body.event.mint) {
    return NextResponse.json({ error: 'event required' }, { status: 400 })
  }
  const result = await dispatchWatchDegradePush(body.event)
  return NextResponse.json(result)
}
