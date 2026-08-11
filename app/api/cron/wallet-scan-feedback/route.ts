import { NextResponse } from 'next/server'
import { runWalletScanFeedbackTick } from '@/lib/terminal-os/wallet-scan-feedback'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * GET/POST /api/cron/wallet-scan-feedback
 * Every ~6h: rescan registered / watchlist wallets via scan gateway → Coach feedback in Redis.
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
    const result = await runWalletScanFeedbackTick()
    return NextResponse.json({ ok: true, ...result })
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
