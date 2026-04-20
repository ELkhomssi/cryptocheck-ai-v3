import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Public payment link URLs (not secrets). Used by client pricing UI.
 */
export async function GET() {
  return NextResponse.json({
    pro: process.env.STRIPE_PRICE_ID_PRO ?? null,
    enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE ?? null,
    proMaxElite: process.env.STRIPE_PRICE_PRO_MAX_ELITE ?? null,
    proMaxDeep: process.env.STRIPE_PRICE_PRO_MAX_DEEP ?? null,
    micropack: process.env.STRIPE_PRICE_MICROPACK ?? null,
  })
}
