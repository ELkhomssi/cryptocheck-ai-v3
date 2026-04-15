import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Stripe Customer Portal — manage plan, invoices, payment method.
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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = getSupabaseAdmin()
  const { data: row } = await sb
    .from('saas_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const customerId = row?.stripe_customer_id as string | null
  if (!customerId) {
    return NextResponse.json(
      { error: 'No Stripe customer on file. Subscribe to a paid plan first.' },
      { status: 400 }
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const body = new URLSearchParams({
    customer: customerId,
    return_url: `${siteUrl}/dashboard/billing`,
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

  const session = await response.json()
  if (!response.ok) {
    return NextResponse.json({ error: session.error?.message ?? 'Stripe error' }, { status: response.status })
  }

  return NextResponse.json({ url: session.url })
}
