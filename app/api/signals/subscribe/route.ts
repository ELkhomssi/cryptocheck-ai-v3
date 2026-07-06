import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  SIGNAL_PREMIUM_PRICE_USD,
  signalPremiumMerchantWallet,
} from '@/lib/signal-aggregator/subscription'

export const dynamic = 'force-dynamic'

/** POST /api/signals/subscribe/order — premium feed payment envelope. */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  return NextResponse.json({
    userId: user.id,
    amountUsd: SIGNAL_PREMIUM_PRICE_USD,
    merchantWallet: signalPremiumMerchantWallet(),
    paymentMemo: `signals_premium:${user.id}`,
  })
}
