import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fulfillSignalPremiumPayment, resolveSignalTier } from '@/lib/signal-aggregator/subscription'

export const dynamic = 'force-dynamic'

/** POST /api/signals/subscribe/fulfill — payment confirmed → premium tier. */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { intentId?: string }
  const intentId = typeof body.intentId === 'string' ? body.intentId.trim() : ''
  if (!intentId.startsWith('pi_')) {
    return NextResponse.json({ error: 'intentId required' }, { status: 400 })
  }

  try {
    await fulfillSignalPremiumPayment(user.id, intentId)
    const tier = await resolveSignalTier({ userId: user.id })
    return NextResponse.json({ ok: true, tier })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Fulfillment failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
