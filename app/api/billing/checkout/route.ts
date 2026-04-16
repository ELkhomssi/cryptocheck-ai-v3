import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { ensureFreeTierSubscription } from '@/lib/services/saas-entitlement.service'

const PRICE_ID_RE = /^price_[a-zA-Z0-9]+$/

function resolveStripePriceId(tier: 'pro' | 'enterprise'): string | null {
  const raw =
    tier === 'enterprise' ? process.env.STRIPE_PRICE_ID_ENTERPRISE : process.env.STRIPE_PRICE_ID_PRO
  if (!raw || !PRICE_ID_RE.test(raw.trim())) return null
  return raw.trim()
}

/**
 * Authenticated Stripe Checkout — attaches `user_id` to session + subscription metadata for webhooks.
 */
export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {},
      },
    }
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureFreeTierSubscription(user.id)

  let tier: 'pro' | 'enterprise' = 'pro'
  try {
    const body = await req.json()
    const raw =
      (typeof body?.tier === 'string' && body.tier) ||
      (typeof body?.plan === 'string' && body.plan) ||
      'pro'
    const t = String(raw).toLowerCase()
    tier = t === 'enterprise' ? 'enterprise' : 'pro'
  } catch {
    /* default tier pro */
  }

  const priceId = resolveStripePriceId(tier)
  if (!priceId) {
    console.error('[billing/checkout] Missing or invalid STRIPE_PRICE_ID_PRO / STRIPE_PRICE_ID_ENTERPRISE')
    return NextResponse.json({ error: 'Billing unavailable' }, { status: 500 })
  }

  const tierMeta = tier === 'enterprise' ? 'ENTERPRISE' : 'PRO'

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${siteUrl}/dashboard/billing?success=true`,
    cancel_url: `${siteUrl}/dashboard/billing?canceled=true`,
    allow_promotion_codes: 'true',
    billing_address_collection: 'auto',
    customer_email: user.email,
    client_reference_id: user.id,
    [`metadata[user_id]`]: user.id,
    [`metadata[email]`]: user.email,
    [`metadata[tier]`]: tierMeta,
    [`subscription_data[metadata][user_id]`]: user.id,
    [`subscription_data[metadata][tier]`]: tierMeta,
    [`subscription_data[metadata][email]`]: user.email,
  })

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-04-10',
    },
    body: params.toString(),
  })

  const session = await response.json()
  if (!response.ok) {
    console.error('[billing/checkout] Stripe API error:', session.error ?? session)
    return NextResponse.json({ error: 'Billing unavailable' }, { status: 502 })
  }

  return NextResponse.json({ url: session.url, sessionId: session.id })
}
