import { NextRequest, NextResponse } from 'next/server'
import { pollBirdeyeMarketAlerts } from '@/lib/terminal/birdeye-alert-poll'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET|POST /api/cron/terminal-market-alerts
 * Auth: Bearer CRON_SECRET
 * Polls Birdeye new listings + smart-money trending → pushAlert (deduped).
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await pollBirdeyeMarketAlerts()
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'poll failed' },
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
