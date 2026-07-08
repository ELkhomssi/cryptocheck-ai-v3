import { NextResponse } from 'next/server'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { createClient } from '@/lib/supabase/server'
import { getFullAccessSnapshot } from '@/lib/billing/full-access'
import { billingCycleFromStripePriceId, planIdFromStripePriceId } from '@/lib/billing/upgrade-plans'
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

  const [snapshot, candidates, arm] = await Promise.all([
    getFullAccessSnapshot(user.id),
    readSnipeCandidates(30),
    getArmState(user.id),
  ])

  const fullAccess = snapshot.fullAccess
  const priceId = snapshot.stripePriceId
  const plan = priceId ? planIdFromStripePriceId(priceId) : null
  const billingCycle = priceId ? billingCycleFromStripePriceId(priceId) : null

  return NextResponse.json(
    {
      authenticated: true,
      fullAccess,
      // Full Auto-Snipe is available to any active full-access plan (Basic or Pro,
      // monthly or annual). Plan/cycle surfaced for display + client-side detection.
      plan,
      billingCycle,
      armed: arm.armed && fullAccess,
      candidates,
      compliance: SIGNAL_COMPLIANCE,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
