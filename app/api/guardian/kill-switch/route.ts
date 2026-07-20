import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveSignalTier } from '@/lib/signal-aggregator/subscription'
import {
  isGuardianKillSwitchActive,
  setGuardianKillSwitch,
} from '@/lib/personal-watch/guardian-auto-exit'

export const dynamic = 'force-dynamic'

/** GET /api/guardian/kill-switch */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const active = await isGuardianKillSwitchActive(user.id)
  return NextResponse.json({ killSwitch: active })
}

/** PATCH /api/guardian/kill-switch { active: boolean } — instantly disables pending auto-exits. */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const tier = await resolveSignalTier({ userId: user.id })
  if (tier !== 'premium') {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { active?: boolean }
  const active = body.active === true
  await setGuardianKillSwitch(user.id, active)

  return NextResponse.json({
    ok: true,
    killSwitch: active,
    note: active
      ? 'All Guardian auto-exits halted until you disarm the kill-switch.'
      : 'Kill-switch cleared — armed positions may auto-prepare exits on DANGER.',
  })
}
