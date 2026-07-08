import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { ensureFreeTierSubscription } from '@/lib/services/saas-entitlement.service'
import { PLANS, type BillingCycle, type UpgradePlanId } from '@/lib/billing/upgrade-plans'
import { resolveStripePriceIdForPlan } from '@/lib/billing/stripe-plan-prices'

/**
 * Authenticated Stripe Checkout for 2-tier FULL_ACCESS plans.
 * Access is granted only after verified webhook — never here.
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
    },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 })

  await ensureFreeTierSubscription(user.id)

  let planId: UpgradePlanId = 'basic'
  let cycle: BillingCycle = 'monthly'
  try {
    const body = await req.json()
    const raw = typeof body?.plan === 'string' ? body.plan.trim().toLowerCase() : 'basic'
    if (raw === 'pro' || raw === 'basic') planId = raw
    const rawCycle = typeof body?.cycle === 'string' ? body.cycle.trim().toLowerCase() : 'monthly'
    if (rawCycle === 'annual' || rawCycle === 'yearly') cycle = 'annual'
  } catch {
    /* default basic monthly */
  }

  if (!PLANS.some((p) => p.id === planId)) {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })
  }

  const priceId = await resolveStripePriceIdForPlan(planId, cycle)
  if (!priceId) {
    console.error(
      '[billing/upgrade-checkout] Set STRIPE_PRODUCT_BASIC/PRO or STRIPE_PRICE_{BASIC,PRO}[_ANNUAL]',
    )
    return NextResponse.json({ error: 'Billing unavailable' }, { status: 500 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${siteUrl}/app/upgrade?checkout=success`,
    cancel_url: `${siteUrl}/app/upgrade?checkout=cancel`,
    allow_promotion_codes: 'true',
    billing_address_collection: 'auto',
    customer_email: user.email,
    client_reference_id: user.id,
    [`metadata[user_id]`]: user.id,
    [`metadata[email]`]: user.email,
    [`metadata[plan]`]: planId,
    [`metadata[cycle]`]: cycle,
    [`metadata[price_id]`]: priceId,
    [`subscription_data[metadata][user_id]`]: user.id,
    [`subscription_data[metadata][plan]`]: planId,
    [`subscription_data[metadata][cycle]`]: cycle,
    [`subscription_data[metadata][email]`]: user.email,
    [`subscription_data[metadata][price_id]`]: priceId,
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
    console.error('[billing/upgrade-checkout] Stripe API error:', session.error ?? session)
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 })
  }

  return NextResponse.json({ url: session.url, sessionId: session.id })
}
