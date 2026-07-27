/**
 * POST /api/webhooks/stripe-entitlements
 * Updates Phase 18 entitlements table from Stripe subscription lifecycle events.
 * Does not replace existing /api/stripe/webhook — additive for identity_users.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { upsertEntitlement } from '@/lib/identity/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header) return false
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const [k, v] = p.split('=')
      return [k, v]
    }),
  )
  const timestamp = parts.t
  const v1 = parts.v1
  if (!timestamp || !v1) return false
  const signed = `${timestamp}.${payload}`
  const expected = createHmac('sha256', secret).update(signed).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET_ENTITLEMENTS || process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'webhook secret missing' }, { status: 503 })
  }
  const payload = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!verifyStripeSignature(payload, sig, secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(payload) as {
    type: string
    data: { object: Record<string, unknown> }
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const obj = event.data.object
      const userId =
        (obj.client_reference_id as string) ||
        ((obj.metadata as { identity_user_id?: string } | undefined)?.identity_user_id ?? '')
      const customerId = typeof obj.customer === 'string' ? obj.customer : null
      const subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : null
      if (userId) {
        await upsertEntitlement({
          userId,
          plan: 'pro',
          status: 'active',
          source: 'stripe',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        })
      }
    }

    if (
      event.type === 'invoice.paid' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.created'
    ) {
      const obj = event.data.object
      const meta = obj.metadata as { identity_user_id?: string } | undefined
      let userId = meta?.identity_user_id
      const customerId = typeof obj.customer === 'string' ? obj.customer : null
      const subscriptionId =
        typeof obj.id === 'string' && event.type.startsWith('customer.subscription')
          ? obj.id
          : typeof obj.subscription === 'string'
            ? obj.subscription
            : null
      const periodEnd =
        typeof obj.current_period_end === 'number'
          ? new Date(obj.current_period_end * 1000).toISOString()
          : typeof (obj as { lines?: { data?: Array<{ period?: { end?: number } }> } }).lines
                ?.data?.[0]?.period?.end === 'number'
            ? new Date(
                (obj as { lines: { data: Array<{ period: { end: number } }> } }).lines.data[0]!
                  .period.end * 1000,
              ).toISOString()
            : null
      const status = String(obj.status || 'active')

      // Resolve identity via subscription/customer if metadata missing (invoice.paid)
      if (!userId && subscriptionId) {
        const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
        const admin = getSupabaseAdmin()
        const { data } = await admin
          .from('entitlements')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle()
        userId = data?.user_id ? String(data.user_id) : undefined
      }
      if (!userId && customerId) {
        const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
        const admin = getSupabaseAdmin()
        const { data } = await admin
          .from('entitlements')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        userId = data?.user_id ? String(data.user_id) : undefined
      }

      if (userId) {
        await upsertEntitlement({
          userId,
          plan: status === 'canceled' || status === 'unpaid' ? 'free' : 'pro',
          status,
          currentPeriodEnd: periodEnd,
          source: 'stripe',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        })
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const obj = event.data.object
      const meta = obj.metadata as { identity_user_id?: string } | undefined
      const userId = meta?.identity_user_id
      if (userId) {
        await upsertEntitlement({
          userId,
          plan: 'free',
          status: 'canceled',
          source: 'stripe',
          stripeCustomerId: typeof obj.customer === 'string' ? obj.customer : null,
          stripeSubscriptionId: typeof obj.id === 'string' ? obj.id : null,
        })
      }
    }
  } catch (e) {
    console.error('[stripe-entitlements webhook]', e)
    return NextResponse.json({ error: 'handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
