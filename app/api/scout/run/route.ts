import { NextRequest, NextResponse } from 'next/server'
import { runScoutCycle } from '@/lib/scout/pipeline'
import { isOperatorUser } from '@/lib/operator/require-operator'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/scout/run — execute one Scout research→plan→draft cycle.
 * Auth: operator session or Bearer CRON_SECRET / SCOUT_RUN_SECRET.
 */
export async function POST(req: NextRequest) {
  const cron = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secret = process.env.SCOUT_RUN_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  const cronOk = Boolean(secret && cron === secret)

  if (!cronOk) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !(await isOperatorUser(user.id, user.email))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  let focusMint: string | null = null
  let maxArticles = 3
  try {
    const body = (await req.json()) as { focusMint?: string; maxArticles?: number }
    focusMint = typeof body.focusMint === 'string' ? body.focusMint : null
    if (typeof body.maxArticles === 'number') maxArticles = body.maxArticles
  } catch {
    /* empty body ok */
  }

  const state = await runScoutCycle({ focusMint, maxArticles })
  return NextResponse.json({ ok: state.status !== 'error', state })
}
