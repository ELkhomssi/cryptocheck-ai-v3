import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Consumer `/app` upgrade flow — Stripe Payment Link URLs (not price_ ids).
 * Fail-closed if any tier env is missing (avoids silent disabled buttons in production).
 */
export async function GET() {
  const micropack = process.env.STRIPE_PRICE_MICROPACK?.trim()
  const proMaxDeep = process.env.STRIPE_PRICE_PRO_MAX_DEEP?.trim()
  const proMaxElite = process.env.STRIPE_PRICE_PRO_MAX_ELITE?.trim()

  if (!micropack || !proMaxDeep || !proMaxElite) {
    console.error('[payment-links] Missing consumer Payment Link env vars:', {
      hasMicropack: !!micropack,
      hasProMaxDeep: !!proMaxDeep,
      hasProMaxElite: !!proMaxElite,
    })
    return NextResponse.json({ error: 'Payment not configured' }, { status: 503 })
  }

  return NextResponse.json({
    micropack,
    proMaxDeep,
    proMaxElite,
  })
}
