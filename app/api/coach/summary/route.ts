import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCoachDashboard } from '@/lib/personal-watch/coach-analytics'
import { resolveSignalTier } from '@/lib/signal-aggregator/subscription'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/coach/summary — authenticated coach panel payload.
 * Premium sees full insights + push-eligible alerts; free sees empty-state + upgrade hint.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  }

  const tier = await resolveSignalTier({ userId: user.id })
  const dash = await buildCoachDashboard(user.id)

  return NextResponse.json({
    tier,
    premium: tier === 'premium',
    ...dash,
    upgradeHint:
      tier === 'premium'
        ? null
        : 'Watch alerts + coach insights are a premium hook — upgrade for continuous personal watch pushes.',
  })
}
