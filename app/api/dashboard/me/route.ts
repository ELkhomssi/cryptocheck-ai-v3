import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSubscription } from '@/lib/services/user-subscription.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sub = await getUserSubscription(user.id)
  return NextResponse.json({
    userId: user.id,
    email: user.email,
    subscription: {
      effectiveTier: sub.effectiveTier,
      runtimeTier: sub.runtimeTier,
      isDefaultFree: sub.isDefaultFree,
      status: sub.record?.status ?? null,
      currentPeriodEnd: sub.record?.current_period_end ?? null,
      cancelAtPeriodEnd: sub.record?.cancel_at_period_end ?? false,
      stripeCustomerId: sub.record?.stripe_customer_id ?? null,
    },
  })
}
