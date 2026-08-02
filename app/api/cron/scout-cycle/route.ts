import { NextRequest, NextResponse } from 'next/server'
import { runScoutCycle } from '@/lib/scout/pipeline'
import { SCOUT_AUTO_PUBLISH } from '@/lib/scout/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Vercel cron — Scout V2 autonomous cycle (auto-publish after quality gates). */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const state = await runScoutCycle({ maxArticles: 2 })
  const published = state.recentArticles.filter((a) => a.status === 'published').length
  return NextResponse.json({
    ok: state.status !== 'error',
    version: 'v2',
    status: state.status,
    autoPublish: SCOUT_AUTO_PUBLISH,
    topics: state.trendingTopics.length,
    queue: state.publicationQueue.length,
    published,
    researchSources: state.researchSources,
    nextResearchAt: state.nextResearchAt,
  })
}
