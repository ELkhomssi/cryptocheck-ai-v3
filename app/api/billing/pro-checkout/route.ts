/**
 * POST /api/billing/pro-checkout — Stripe Checkout for Phase 18 Pro plan.
 * Uses hosted Stripe Checkout; writes lifecycle via /api/webhooks/stripe-entitlements.
 */

import { NextRequest, NextResponse } from 'next/server'
import { readSiwsSessionFromRequest } from '@/lib/identity/session'
import { getEntitlement } from '@/lib/identity/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_PRICE_PRO || process.env.STRIPE_PRICE_ID_PRO
  if (!secretKey || !priceId) {
    return NextResponse.json(
      { error: 'Pro billing is not configured (STRIPE_SECRET_KEY / STRIPE_PRICE_PRO).' },
      { status: 503 },
    )
  }

  const session = readSiwsSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Sign in with Solana first.' }, { status: 401 })
  }

  const entitlement = await getEntitlement(session.userId)
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const params = new URLSearchParams()
  params.set('mode', 'subscription')
  params.set('success_url', `${siteUrl}/terminal?nav=portfolio&billing=success`)
  params.set('cancel_url', `${siteUrl}/terminal?nav=portfolio&billing=cancel`)
  params.set('line_items[0][price]', priceId)
  params.set('line_items[0][quantity]', '1')
  params.set('client_reference_id', session.userId)
  params.set('metadata[identity_user_id]', session.userId)
  params.set('metadata[wallet]', session.wallet)
  params.set('subscription_data[metadata][identity_user_id]', session.userId)
  if (entitlement?.stripeCustomerId) {
    params.set('customer', entitlement.stripeCustomerId)
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-04-10',
    },
    body: params.toString(),
  })
  const json = (await response.json()) as { id?: string; url?: string; error?: { message?: string } }
  if (!response.ok || !json.url) {
    return NextResponse.json(
      { error: json.error?.message || 'Checkout session failed' },
      { status: 502 },
    )
  }
  return NextResponse.json({ url: json.url, id: json.id })
}
