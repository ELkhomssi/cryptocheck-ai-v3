import { NextResponse } from 'next/server'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { createClient } from '@/lib/supabase/server'
import { userHasFullPlatformAccess } from '@/lib/billing/full-access'
import { getArmState, readSnipeCandidates } from '@/lib/signal-aggregator/snipe-execution'

export const dynamic = 'force-dynamic'

/**
 * GET /api/signals/snipe/candidates
 * Vetted, safe, high-conviction snipe candidates from the sniper worker.
 * Readable by any signed-in user; only full-access users can arm / auto-execute.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.json(
      { authenticated: false, fullAccess: false, candidates: [], compliance: SIGNAL_COMPLIANCE },
      { headers: { 'cache-control': 'no-store' } },
    )
  }

  const [fullAccess, candidates, arm] = await Promise.all([
    userHasFullPlatformAccess(user.id),
    readSnipeCandidates(30),
    getArmState(user.id),
  ])

  return NextResponse.json(
    {
      authenticated: true,
      fullAccess,
      armed: arm.armed && fullAccess,
      candidates,
      compliance: SIGNAL_COMPLIANCE,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
