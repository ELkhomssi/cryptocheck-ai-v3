import { NextRequest, NextResponse } from 'next/server'

// ── Price IDs from your Stripe dashboard ──────────────────────
// weekly → $5/week   → price_1T7JMPAkjKVFT4LeDqPZOdMe
// yearly → $200/year → price_1T9vdDAkjKVFT4LeAb9952Gt
// vip    → $30/month → set STRIPE_PRICE_VIP in .env.local
const PRICES: Record<string, string> = {
  weekly:  process.env.STRIPE_PRICE_WEEKLY   ?? 'price_1T7JMPAkjKVFT4LeDqPZOdMe',
  yearly:  process.env.STRIPE_PRICE_YEARLY   ?? 'price_1T9vdDAkjKVFT4LeAb9952Gt',
  vip:     process.env.STRIPE_PRICE_VIP      ?? 'price_1TCTrmAkjKVFT4Le6GBIJ5K8',
  starter: process.env.STRIPE_PRICE_STARTER  ?? 'price_1T7JMPAkjKVFT4LeDqPZOdMe', // $5 one-time
  deep:    process.env.STRIPE_PRICE_VIP       ?? 'price_1TCTrmAkjKVFT4Le6GBIJ5K8', // $30/month Pro Max Deep
  whale:   process.env.STRIPE_PRICE_YEARLY   ?? 'price_1T9vdDAkjKVFT4LeAb9952Gt', // custom
}

export async function POST(req: NextRequest) {
  console.log('[Stripe] Checkout route hit')

  // 1. Read secret key
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    console.error('[Stripe] ERROR: STRIPE_SECRET_KEY is not set in .env.local')
    return NextResponse.json(
      { error: 'Stripe secret key not configured' },
      { status: 500 }
    )
  }
  console.log('[Stripe] Key found:', secretKey.slice(0, 12) + '...')

  // 2. Parse request body
  let plan: string
  try {
    const body = await req.json()
    plan = body.plan
    console.log('[Stripe] Plan requested:', plan)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // 3. Resolve price ID
  const priceId = PRICES[plan]
  if (!priceId) {
    console.error('[Stripe] ERROR: Unknown plan:', plan)
    return NextResponse.json({ error: `Unknown plan: ${plan}` }, { status: 400 })
  }
  console.log('[Stripe] Using price ID:', priceId)

  // 4. Get site URL for redirect
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'

  // 5. Create Stripe Checkout Session via REST API
  //    (no Stripe SDK needed — pure fetch)
  try {
    const body = new URLSearchParams({
      'mode':                       'subscription',
      'line_items[0][price]':       priceId,
      'line_items[0][quantity]':    '1',
      'success_url':                `${siteUrl}/?checkout=success&plan=${plan}`,
      'cancel_url':                 `${siteUrl}/?checkout=cancel`,
      'allow_promotion_codes':      'true',
      'billing_address_collection': 'auto',
    })

    console.log('[Stripe] Creating session with price:', priceId)

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${secretKey}`,
        'Content-Type':   'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-04-10',
      },
      body: body.toString(),
    })

    const session = await response.json()

    if (!response.ok) {
      console.error('[Stripe] API error:', session.error?.message ?? session)
      return NextResponse.json(
        { error: session.error?.message ?? 'Stripe API error' },
        { status: response.status }
      )
    }

    console.log('[Stripe] Session created:', session.id)
    console.log('[Stripe] Redirect URL:', session.url)

    return NextResponse.json({ url: session.url, sessionId: session.id })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Stripe] Fetch error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
