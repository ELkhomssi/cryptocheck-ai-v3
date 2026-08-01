import { NextRequest, NextResponse } from 'next/server'
import { runScoutCycle } from '@/lib/scout/pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Vercel cron — drafts only (approval still required unless SCOUT_AUTO_PUBLISH=1). */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const state = await runScoutCycle({ maxArticles: 2 })
  return NextResponse.json({
    ok: state.status !== 'error',
    status: state.status,
    topics: state.trendingTopics.length,
    queue: state.publicationQueue.length,
  })
}
