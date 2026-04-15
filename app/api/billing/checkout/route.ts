import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { ensureFreeTierSubscription } from '@/lib/services/saas-entitlement.service'

const PLAN_PRICES: Record<string, string> = {
  pro: process.env.STRIPE_PRICE_PRO ?? process.env.STRIPE_PRICE_VIP ?? 'price_1TCTrmAkjKVFT4Le6GBIJ5K8',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? process.env.STRIPE_PRICE_YEARLY ?? 'price_1T9vdDAkjKVFT4LeAb9952Gt',
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

  let plan = 'pro'
  try {
    const body = await req.json()
    if (typeof body?.plan === 'string') plan = body.plan.toLowerCase()
  } catch {
    /* default pro */
  }

  const priceId = plan === 'enterprise' ? PLAN_PRICES.enterprise : PLAN_PRICES.pro
  const tierMeta = plan === 'enterprise' ? 'ENTERPRISE' : 'PRO'

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${siteUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${siteUrl}/dashboard/billing?checkout=cancel`,
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
    return NextResponse.json({ error: session.error?.message ?? 'Stripe error' }, { status: response.status })
  }

  return NextResponse.json({ url: session.url, sessionId: session.id })
}
