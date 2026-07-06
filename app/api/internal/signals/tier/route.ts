import { NextRequest, NextResponse } from 'next/server'
import { resolveSignalTier } from '@/lib/signal-aggregator/subscription'

export const dynamic = 'force-dynamic'

function assertWorker(req: NextRequest): boolean {
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  return Boolean(secret && header === secret)
}

/** GET /api/internal/signals/tier?userId= — worker/gateway tier bridge. */
export async function GET(req: NextRequest) {
  if (!assertWorker(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = req.nextUrl.searchParams.get('userId')?.trim()
  const tier = await resolveSignalTier({ userId: userId || undefined })
  return NextResponse.json({ tier })
}
