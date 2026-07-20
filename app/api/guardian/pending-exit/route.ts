import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveSignalTier } from '@/lib/signal-aggregator/subscription'
import { getPendingGuardianExit } from '@/lib/personal-watch/guardian-auto-exit'
import { COMPLIANCE_DISCLAIMER, FEE_DISCLOSURE_PATH } from '@/lib/revenue-dashboard/constants'

export const dynamic = 'force-dynamic'

/** GET /api/guardian/pending-exit?id= — unsigned swap tx + fee disclosure for wallet signing. */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const tier = await resolveSignalTier({ userId: user.id })
  if (tier !== 'premium') {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')?.trim() ?? ''
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const pending = await getPendingGuardianExit(user.id, id)
  if (!pending) {
    return NextResponse.json({ error: 'Pending exit not found or kill-switch active' }, { status: 404 })
  }

  return NextResponse.json({
    pending,
    compliance: COMPLIANCE_DISCLAIMER,
    feeDisclosurePath: FEE_DISCLOSURE_PATH,
    nonCustodial: true,
  })
}
