import { NextRequest, NextResponse } from 'next/server'
import { renderExecMetricsPrometheus } from '@/lib/execution'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/internal/execution/metrics
 * Prometheus text exposition. Auth: SIGNAL_WORKER_SECRET or CRON_SECRET bearer.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = renderExecMetricsPrometheus()
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
