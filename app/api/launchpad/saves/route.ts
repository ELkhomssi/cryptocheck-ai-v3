import { NextResponse } from 'next/server'
import { createClientOptional } from '@/lib/supabase/server'
import { getSaveRateStats, listSavedYouForUser } from '@/lib/launchpad/saved-you'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/launchpad/saves — Your Saves list + honest save-rate stats. */
export async function GET() {
  try {
    let userId: string | null = null
    try {
      const sb = await createClientOptional()
      if (sb) {
        const { data } = await sb.auth.getUser()
        userId = data.user?.id ?? null
      }
    } catch {
      /* anonymous */
    }

    const [saves, stats] = await Promise.all([
      listSavedYouForUser(userId, 40),
      getSaveRateStats(),
    ])

    return NextResponse.json(
      { saves, stats, newestId: saves[0]?.id },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      {
        saves: [],
        stats: { blocks: 0, rugged: 0, survived: 0, pending: 0, saveRatePct: null },
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    )
  }
}
