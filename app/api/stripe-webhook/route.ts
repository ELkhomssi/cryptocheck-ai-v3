import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { upsertSaasSubscription } from '@/lib/services/saas-subscription.service'
import type { SaasSubscriptionStatus, SaasTier } from '@/lib/types/saas-subscription'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  _stripe = new Stripe(key)
  return _stripe
}

function resolveTierFromStripeMetadata(meta: Record<string, string> | undefined): SaasTier {
  const p = String(meta?.tier || meta?.plan || '').toLowerCase()
  if (p === 'enterprise' || p === 'institutional') return 'ENTERPRISE'
  if (p === 'pro') return 'PRO'
  return 'PRO'
}

async function syncProfileAndSaas(params: {
  email: string
  tier: SaasTier
  status: SaasSubscriptionStatus
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}) {
  const isPro = params.tier !== 'FREE'
  const plan = params.tier === 'ENTERPRISE' ? 'institutional' : params.tier === 'PRO' ? 'pro' : 'free'

  const { error } = await supabase
    .from('profiles')
    .update({ is_pro: isPro, plan })
    .eq('email', params.email)

  if (error) console.error('Supabase profile update error:', error)

  const { data: profile } = await supabase.from('profiles').select('id').eq('email', params.email).maybeSingle()
  if (!profile?.id) return

  try {
    await upsertSaasSubscription({
      userId: profile.id,
      tier: params.tier,
      status: params.status,
      currentPeriodStart: params.currentPeriodStart,
      currentPeriodEnd: params.currentPeriodEnd,
      cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      stripeCustomerId: params.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId,
    })
  } catch (e) {
    console.error('[stripe-webhook] saas_subscriptions upsert:', e)
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured — refusing to process')
    return NextResponse.json(
      { error: 'Webhook misconfigured' },
      { status: 500 }
    )
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as unknown as Record<string, unknown>
      const meta = session.metadata as Record<string, string> | undefined
      const email =
        (session.customer_email as string) ||
        (session.customer_details as { email?: string } | undefined)?.email ||
        meta?.email

      const subRef = session.subscription as string | { id?: string } | null | undefined
      const stripeSubscriptionId =
        typeof subRef === 'string' ? subRef : typeof subRef === 'object' && subRef?.id ? subRef.id : null

      const custRef = session.customer as string | { id?: string } | null | undefined
      const stripeCustomerId =
        typeof custRef === 'string' ? custRef : typeof custRef === 'object' && custRef?.id ? custRef.id : null

      const cps = session.current_period_start as number | undefined
      const cpe = session.current_period_end as number | undefined
      const start = cps ? new Date(cps * 1000) : new Date()
      const end = cpe ? new Date(cpe * 1000) : new Date(Date.now() + 30 * 86400000)

      const tier = resolveTierFromStripeMetadata(meta)

      if (meta?.user_id && typeof meta.user_id === 'string') {
        try {
          await upsertSaasSubscription({
            userId: meta.user_id,
            tier,
            status: 'active',
            currentPeriodStart: start,
            currentPeriodEnd: end,
            cancelAtPeriodEnd: !!(session.cancel_at_period_end as boolean),
            stripeCustomerId,
            stripeSubscriptionId,
          })
          if (email) {
            await supabase
              .from('profiles')
              .update({
                is_pro: tier !== 'FREE',
                plan: tier === 'ENTERPRISE' ? 'institutional' : tier === 'PRO' ? 'pro' : 'free',
              })
              .eq('id', meta.user_id)
          }
          console.log('✅ SENTINEL SaaS sync (checkout by user_id):', meta.user_id, tier)
        } catch (e) {
          console.error('[stripe-webhook] checkout user_id upsert:', e)
        }
      }

      if (email && typeof email === 'string' && !meta?.user_id) {
        await syncProfileAndSaas({
          email,
          tier,
          status: 'active',
          currentPeriodStart: start,
          currentPeriodEnd: end,
          cancelAtPeriodEnd: !!(session.cancel_at_period_end as boolean),
          stripeCustomerId,
          stripeSubscriptionId,
        })
        console.log('✅ SENTINEL SaaS sync (checkout) for:', email, tier)
      }
    }

    if (event.type === 'customer.subscription.created') {
      const sub = event.data.object as unknown as Record<string, unknown>
      const meta = sub.metadata as Record<string, string> | undefined
      const email = meta?.email
      if (email && typeof email === 'string') {
        const tier = resolveTierFromStripeMetadata(meta)
        const cps = sub.current_period_start as number | undefined
        const cpe = sub.current_period_end as number | undefined
        const start = cps ? new Date(cps * 1000) : new Date()
        const end = cpe ? new Date(cpe * 1000) : new Date(Date.now() + 30 * 86400000)
        const stripeSubscriptionId = typeof sub.id === 'string' ? sub.id : null
        const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : null

        await syncProfileAndSaas({
          email,
          tier,
          status: 'active',
          currentPeriodStart: start,
          currentPeriodEnd: end,
          cancelAtPeriodEnd: !!(sub.cancel_at_period_end as boolean),
          stripeCustomerId,
          stripeSubscriptionId,
        })
        console.log('✅ SENTINEL SaaS sync (subscription.created) for:', email, tier)
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      const inv = event.data.object as unknown as Record<string, unknown>
      const email = inv.customer_email as string | undefined
      if (email) {
        const tier = resolveTierFromStripeMetadata(inv.metadata as Record<string, string> | undefined)
        const lines = inv.lines as { data?: Array<{ period?: { end?: number; start?: number } }> } | undefined
        const periodEnd = lines?.data?.[0]?.period?.end
        const periodStart = lines?.data?.[0]?.period?.start
        const subId = inv.subscription as string | undefined
        const custId = inv.customer as string | undefined
        await syncProfileAndSaas({
          email,
          tier,
          status: 'active',
          currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : new Date(Date.now() + 30 * 86400000),
          cancelAtPeriodEnd: false,
          stripeCustomerId: custId ?? null,
          stripeSubscriptionId: subId ?? null,
        })
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as unknown as Record<string, unknown>
      const meta = sub.metadata as Record<string, string> | undefined
      const email = meta?.email
      const userId = meta?.user_id

      if (typeof userId === 'string' && userId.length > 0) {
        await supabase.from('profiles').update({ is_pro: false, plan: 'free' }).eq('id', userId)
        try {
          await upsertSaasSubscription({
            userId,
            tier: 'FREE',
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : null,
            stripeSubscriptionId: null,
          })
        } catch (e) {
          console.error('[stripe-webhook] saas cancel:', e)
        }
        console.log('❌ Subscription deleted for user:', userId)
      } else if (email) {
        await supabase.from('profiles').update({ is_pro: false, plan: 'free' }).eq('email', email)
        const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
        if (profile?.id) {
          try {
            await upsertSaasSubscription({
              userId: profile.id,
              tier: 'FREE',
              status: 'active',
              currentPeriodStart: new Date(),
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : null,
              stripeSubscriptionId: null,
            })
          } catch (e) {
            console.error('[stripe-webhook] saas cancel:', e)
          }
        }
        console.log('❌ PRO cancelled for:', email)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 })
  }
}
