import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  SIGNAL_PREMIUM_PRICE_USD,
  resolveSignalTier,
  signalPremiumMerchantWallet,
} from '@/lib/signal-aggregator/subscription'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'

export const dynamic = 'force-dynamic'

/** GET /api/signals/subscription — authenticated tier for Master Feed. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({
      tier: 'free' as const,
      authenticated: false,
      compliance: SIGNAL_COMPLIANCE,
    })
  }

  const tier = await resolveSignalTier({ userId: user.id })
  return NextResponse.json({
    tier,
    authenticated: true,
    userId: user.id,
    priceUsd: SIGNAL_PREMIUM_PRICE_USD,
    merchantWallet: signalPremiumMerchantWallet(),
    compliance: SIGNAL_COMPLIANCE,
  })
}
