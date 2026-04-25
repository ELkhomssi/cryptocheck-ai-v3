import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

/** Stripe subscription resource (explicit shape avoids `Subscription` name clashes with other deps). */
type StripeSubscriptionResource = {
  id: string
  metadata: Stripe.Metadata | null
  current_period_start: number
  current_period_end: number
  cancel_at_period_end: boolean | null
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
}
import { createClient } from '@supabase/supabase-js'
import { upsertSaasSubscription } from '@/lib/services/saas-subscription.service'
import type { SaasSubscriptionStatus, SaasTier } from '@/lib/types/saas-subscription'

/** Narrow Stripe `checkout.session.completed` payload (avoids `Session` name clashes in typings). */
type CompletedCheckoutSessionPayload = {
  id: string
  customer_email?: string | null
  customer_details?: { email?: string | null } | null
  metadata?: Stripe.Metadata | null
  subscription?: string | null
  customer?: string | null
  client_reference_id?: string | null
  current_period_start?: number | null
  current_period_end?: number | null
  cancel_at_period_end?: boolean | null
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  _stripe = new Stripe(key)
  return _stripe
}

type ResolvedCheckout = {
  plan: string
  planType: string
  isPro: boolean
  isElite?: boolean
  saasTier: SaasTier | null
  grantStarterCredits?: boolean
}

function normalizePaymentUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function resolveFromPaymentLinkUrl(plUrl: string): ResolvedCheckout | null {
  const u = normalizePaymentUrl(plUrl)
  const pairs: Array<{ env?: string; out: ResolvedCheckout }> = [
    {
      env: process.env.STRIPE_PRICE_ID_PRO,
      out: { plan: 'pro', planType: 'pro', isPro: true, saasTier: 'PRO' },
    },
    {
      env: process.env.STRIPE_PRICE_ID_ENTERPRISE,
      out: { plan: 'institutional', planType: 'enterprise', isPro: true, saasTier: 'ENTERPRISE' },
    },
    {
      env: process.env.STRIPE_PRICE_PRO_MAX_ELITE,
      out: { plan: 'elite', planType: 'pro_max_elite', isPro: true, isElite: true, saasTier: 'PRO_MAX_ELITE' },
    },
    {
      env: process.env.STRIPE_PRICE_PRO_MAX_DEEP,
      out: { plan: 'deep', planType: 'pro_max_deep', isPro: true, saasTier: 'PRO_MAX_DEEP' },
    },
    {
      env: process.env.STRIPE_PRICE_MICROPACK,
      out: { plan: 'starter', planType: 'micropack', isPro: false, saasTier: null, grantStarterCredits: true },
    },
  ]
  for (const { env, out } of pairs) {
    if (env && u === normalizePaymentUrl(env)) return out
  }
  return null
}

function resolveFromMetadata(meta: Record<string, string> | undefined): ResolvedCheckout | null {
  const p = String(meta?.tier || meta?.plan || meta?.plan_type || '').toLowerCase()
  if (!p) return null
  if (p === 'enterprise' || p === 'institutional')
    return { plan: 'institutional', planType: 'enterprise', isPro: true, saasTier: 'ENTERPRISE' }
  if (p === 'pro' || p === 'pro-developer' || p === 'pro_developer')
    return { plan: 'pro', planType: 'pro', isPro: true, saasTier: 'PRO' }
  if (p === 'deep' || p === 'pro_max_deep')
    return { plan: 'deep', planType: 'pro_max_deep', isPro: true, saasTier: 'PRO_MAX_DEEP' }
  if (p === 'elite' || p === 'pro_max_elite')
    return { plan: 'elite', planType: 'pro_max_elite', isPro: true, isElite: true, saasTier: 'PRO_MAX_ELITE' }
  if (p === 'starter' || p === 'micropack')
    return { plan: 'starter', planType: 'micropack', isPro: false, saasTier: null, grantStarterCredits: true }
  return null
}

function resolveTierFromStripeMetadata(meta: Record<string, string> | undefined): SaasTier {
  const r = resolveFromMetadata(meta)
  if (r?.saasTier) return r.saasTier
  const p = String(meta?.tier || meta?.plan || '').toLowerCase()
  if (p === 'enterprise' || p === 'institutional') return 'ENTERPRISE'
  if (p === 'elite' || p === 'pro_max_elite') return 'PRO_MAX_ELITE'
  if (p === 'deep' || p === 'pro_max_deep') return 'PRO_MAX_DEEP'
  if (p === 'pro' || p === 'pro-developer') return 'PRO'
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
  planType?: string
}) {
  const isPro = params.tier !== 'FREE'
  const plan =
    params.tier === 'ENTERPRISE'
      ? 'institutional'
      : params.tier === 'PRO_MAX_ELITE'
        ? 'elite'
        : params.tier === 'PRO_MAX_DEEP'
          ? 'deep'
          : params.tier === 'PRO'
            ? 'pro'
            : 'free'
  const isElite = params.tier === 'ENTERPRISE' || params.tier === 'PRO_MAX_ELITE'

  const { error } = await supabase
    .from('profiles')
    .update({
      is_pro: isPro,
      is_elite: isElite,
      plan,
      tier: params.tier,
      ...(params.planType ? { plan_type: params.planType } : {}),
    })
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

async function resolveCheckoutPlan(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<ResolvedCheckout | null> {
  const meta = session.metadata as Record<string, string> | undefined
  const fromMeta = resolveFromMetadata(meta)
  if (fromMeta) return fromMeta

  const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ['payment_link'] })
  const pl = full.payment_link
  if (pl && typeof pl === 'object' && 'url' in pl && typeof (pl as Stripe.PaymentLink).url === 'string') {
    const hit = resolveFromPaymentLinkUrl((pl as Stripe.PaymentLink).url!)
    if (hit) return hit
  }
  if (typeof full.payment_link === 'string') {
    const link = await stripe.paymentLinks.retrieve(full.payment_link)
    if (link.url) {
      const hit = resolveFromPaymentLinkUrl(link.url)
      if (hit) return hit
    }
  }
  return null
}

async function applyProfileAfterCheckout(
  profileId: string,
  resolution: ResolvedCheckout,
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
  periodStart: Date,
  periodEnd: Date,
  cancelAtPeriodEnd: boolean,
  checkoutSessionId?: string | null
) {
  if (resolution.grantStarterCredits && checkoutSessionId) {
    const { data: existing } = await supabase.from('subscriptions').select('id').eq('tx_signature', checkoutSessionId).maybeSingle()
    if (existing) {
      console.log('[stripe-webhook] duplicate micropack session', checkoutSessionId)
      return
    }
  }

  const upd: Record<string, unknown> = {
    is_pro: resolution.isPro,
    plan: resolution.plan,
    plan_type: resolution.planType,
  }
  if (resolution.isElite) upd.is_elite = true
  if (resolution.saasTier) {
    upd.tier = resolution.saasTier
    const t = resolution.saasTier
    upd.is_elite = t === 'ENTERPRISE' || t === 'PRO_MAX_ELITE' || !!resolution.isElite
  }

  if (resolution.grantStarterCredits) {
    const { data: p, error: selErr } = await supabase.from('profiles').select('credits').eq('id', profileId).maybeSingle()
    if (selErr) console.error('[stripe-webhook] profile credits select:', selErr)
    const nextCredits = (p?.credits ?? 0) + 10
    upd.credits = nextCredits
    const { error: insErr } = await supabase.from('credit_transactions').insert({
      user_id: profileId,
      amount: 10,
      reason: 'purchase_micropack',
      balance_after: nextCredits,
    })
    if (insErr) console.error('[stripe-webhook] credit_transactions insert:', insErr)
  }

  const { error } = await supabase.from('profiles').update(upd).eq('id', profileId)
  if (error) console.error('[stripe-webhook] profile update:', error)

  if (resolution.grantStarterCredits && checkoutSessionId) {
    const { error: subErr } = await supabase.from('subscriptions').insert({
      user_id: profileId,
      plan: 'starter',
      plan_label: 'Micro Pack (Stripe)',
      tx_signature: checkoutSessionId,
      status: 'active',
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      amount_usd: 5,
    })
    if (subErr) console.error('[stripe-webhook] micropack subscriptions insert:', subErr)
  }

  if (resolution.saasTier) {
    try {
      await upsertSaasSubscription({
        userId: profileId,
        tier: resolution.saasTier,
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd,
        stripeCustomerId,
        stripeSubscriptionId,
      })
    } catch (e) {
      console.error('[stripe-webhook] saas upsert by profile id:', e)
    }
  }
}

export async function handleStripeWebhook(req: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured — refusing to process')
    return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const checkoutSession = event.data.object as CompletedCheckoutSessionPayload
      const stripe = getStripe()
      const resolution = await resolveCheckoutPlan(stripe, checkoutSession as Stripe.Checkout.Session)
      if (!resolution) {
        console.warn('[stripe-webhook] checkout.session.completed: could not resolve plan', checkoutSession.id)
        return NextResponse.json({ received: true })
      }

      const email =
        checkoutSession.customer_email ||
        checkoutSession.customer_details?.email ||
        (checkoutSession.metadata as Record<string, string> | undefined)?.email

      const subRef = checkoutSession.subscription
      const stripeSubscriptionId = typeof subRef === 'string' ? subRef : subRef && typeof subRef === 'object' && 'id' in subRef ? (subRef as { id: string }).id : null

      const custRef = checkoutSession.customer
      const stripeCustomerId =
        typeof custRef === 'string' ? custRef : custRef && typeof custRef === 'object' && 'id' in custRef ? (custRef as { id: string }).id : null

      const cps = checkoutSession.current_period_start
      const cpe = checkoutSession.current_period_end
      const periodStart = typeof cps === 'number' ? new Date(cps * 1000) : new Date()
      const periodEnd = typeof cpe === 'number' ? new Date(cpe * 1000) : new Date(Date.now() + 30 * 86400000)
      const cancelAtPeriodEnd = !!checkoutSession.cancel_at_period_end

      const meta = checkoutSession.metadata as Record<string, string> | undefined
      const clientRef = checkoutSession.client_reference_id
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      let profileId: string | null =
        (meta?.user_id && uuidRe.test(meta.user_id) ? meta.user_id : null) ||
        (clientRef && uuidRe.test(clientRef) ? clientRef : null)

      if (!profileId && email && typeof email === 'string') {
        const { data: prof } = await supabase.from('profiles').select('id').eq('email', email.toLowerCase()).maybeSingle()
        profileId = prof?.id ?? null
      }

      if (profileId) {
        await applyProfileAfterCheckout(
          profileId,
          resolution,
          stripeCustomerId,
          stripeSubscriptionId,
          periodStart,
          periodEnd,
          cancelAtPeriodEnd,
          checkoutSession.id
        )
      } else {
        console.warn('[stripe-webhook] checkout.session.completed: no matching profile', checkoutSession.id)
      }
    }

    if (event.type === 'customer.subscription.created') {
      const stripeSub = event.data.object as unknown as StripeSubscriptionResource
      const meta = stripeSub.metadata as Record<string, string> | undefined
      const subEmail = meta?.email
      if (subEmail && typeof subEmail === 'string') {
        const tier = resolveTierFromStripeMetadata(meta)
        const cps = stripeSub.current_period_start
        const cpe = stripeSub.current_period_end
        const start = typeof cps === 'number' ? new Date(cps * 1000) : new Date()
        const end = typeof cpe === 'number' ? new Date(cpe * 1000) : new Date(Date.now() + 30 * 86400000)
        const stripeSubscriptionId = typeof stripeSub.id === 'string' ? stripeSub.id : null
        const stripeCustomerId = typeof stripeSub.customer === 'string' ? stripeSub.customer : null

        await syncProfileAndSaas({
          email: subEmail.toLowerCase(),
          tier,
          status: 'active',
          currentPeriodStart: start,
          currentPeriodEnd: end,
          cancelAtPeriodEnd: !!stripeSub.cancel_at_period_end,
          stripeCustomerId,
          stripeSubscriptionId,
          planType: resolveFromMetadata(meta)?.planType,
        })
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      const inv = event.data.object as unknown as {
        customer_email?: string | null
        metadata?: Record<string, string> | null
        lines?: { data?: Array<{ period?: { end?: number; start?: number } }> }
        subscription?: string | null
        customer?: string | null
      }
      const invEmail = inv.customer_email
      if (invEmail) {
        const tier = resolveTierFromStripeMetadata(inv.metadata ?? undefined)
        const lines = inv.lines?.data
        const periodEnd = lines?.[0]?.period?.end
        const periodStart = lines?.[0]?.period?.start
        const subId = typeof inv.subscription === 'string' ? inv.subscription : null
        const custId = typeof inv.customer === 'string' ? inv.customer : null
        await syncProfileAndSaas({
          email: invEmail.toLowerCase(),
          tier,
          status: 'active',
          currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : new Date(Date.now() + 30 * 86400000),
          cancelAtPeriodEnd: false,
          stripeCustomerId: custId,
          stripeSubscriptionId: subId,
          planType: resolveFromMetadata(inv.metadata as Record<string, string> | undefined)?.planType,
        })
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const stripeSub = event.data.object as unknown as StripeSubscriptionResource
      const meta = stripeSub.metadata as Record<string, string> | undefined
      const delEmail = meta?.email
      const userId = meta?.user_id

      if (typeof userId === 'string' && userId.length > 0) {
        await supabase
          .from('profiles')
          .update({ is_pro: false, is_elite: false, plan: 'free', plan_type: 'free', tier: 'FREE' })
          .eq('id', userId)
        try {
          await upsertSaasSubscription({
            userId,
            tier: 'FREE',
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            stripeCustomerId: typeof stripeSub.customer === 'string' ? stripeSub.customer : null,
            stripeSubscriptionId: null,
          })
        } catch (e) {
          console.error('[stripe-webhook] saas cancel:', e)
        }
      } else if (delEmail) {
        await supabase
          .from('profiles')
          .update({ is_pro: false, is_elite: false, plan: 'free', plan_type: 'free', tier: 'FREE' })
          .eq('email', delEmail.toLowerCase())
        const { data: profile } = await supabase.from('profiles').select('id').eq('email', delEmail.toLowerCase()).maybeSingle()
        if (profile?.id) {
          try {
            await upsertSaasSubscription({
              userId: profile.id,
              tier: 'FREE',
              status: 'active',
              currentPeriodStart: new Date(),
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              stripeCustomerId: typeof stripeSub.customer === 'string' ? stripeSub.customer : null,
              stripeSubscriptionId: null,
            })
          } catch (e) {
            console.error('[stripe-webhook] saas cancel:', e)
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 })
  }
}
