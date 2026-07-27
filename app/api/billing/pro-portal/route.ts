/**
 * POST /api/billing/pro-portal — Stripe Customer Portal for SIWS Pro subscribers.
 * Hosted Stripe flow only; no custom card storage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { readSiwsSessionFromRequest } from '@/lib/identity/session'
import { getEntitlement } from '@/lib/identity/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const session = readSiwsSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Sign in with Solana first.' }, { status: 401 })
  }

  const entitlement = await getEntitlement(session.userId)
  const customerId = entitlement?.stripeCustomerId
  if (!customerId) {
    return NextResponse.json(
      { error: 'No Stripe customer on file. Subscribe to Pro first.' },
      { status: 400 },
    )
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const body = new URLSearchParams({
    customer: customerId,
    return_url: `${siteUrl}/terminal?nav=mission&billing=portal`,
  })

  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-04-10',
    },
    body: body.toString(),
  })

  const json = (await response.json()) as { url?: string; error?: { message?: string } }
  if (!response.ok || !json.url) {
    console.error('[billing/pro-portal]', json.error ?? json)
    return NextResponse.json({ error: json.error?.message || 'Billing portal unavailable' }, { status: 502 })
  }
  return NextResponse.json({ url: json.url })
}
