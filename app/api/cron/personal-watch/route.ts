import { NextResponse } from 'next/server'
import { runPersonalWatchTick } from '@/lib/personal-watch/runner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * GET/POST /api/cron/personal-watch
 * Continuous rescan of unique tokens across watchlist ∪ portfolio holdings.
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
    const result = await runPersonalWatchTick()
    return NextResponse.json({
      ok: true,
      ...result,
      evidence: {
        costModel: 'scansExecuted === unique mints scanned this tick (capped), not user×mint',
        watchlistRows: result.watchlistRows,
        uniqueMints: result.uniqueMints,
        scansExecuted: result.scansExecuted,
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
