import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { upsertSaasSubscription } from '@/lib/services/saas-subscription.service'
import {
  isFullAccessStripePriceId,
  resolvePlanIdFromStripePriceId,
} from '@/lib/billing/stripe-plan-prices'
import type { SaasSubscriptionStatus } from '@/lib/types/saas-subscription'
import type Stripe from 'stripe'

export function subscriptionStatusToSaas(status: string): SaasSubscriptionStatus {
  const s = status.toLowerCase()
  if (s === 'trialing') return 'trialing'
  if (s === 'past_due') return 'past_due'
  if (s === 'canceled' || s === 'unpaid' || s === 'incomplete_expired') return 'canceled'
  return 'active'
}

export function subscriptionGrantsFullAccess(stripeStatus: string): boolean {
  const s = stripeStatus.toLowerCase()
  return s === 'active' || s === 'trialing'
}

/** Grant FULL_ACCESS from verified Stripe subscription (webhook-only). */
export async function grantFullAccessFromStripe(params: {
  userId: string
  priceId: string
  status: SaasSubscriptionStatus
  periodStart: Date
  periodEnd: Date | null
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}): Promise<void> {
  const planId = (await resolvePlanIdFromStripePriceId(params.priceId)) ?? 'pro'

  await upsertSaasSubscription({
    userId: params.userId,
    tier: 'PRO',
    status: params.status,
    currentPeriodStart: params.periodStart,
    currentPeriodEnd: params.periodEnd,
    cancelAtPeriodEnd: params.cancelAtPeriodEnd,
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    fullAccess: true,
    stripePriceId: params.priceId,
  })

  const { error } = await getSupabaseAdmin()
    .from('profiles')
    .update({
      is_pro: true,
      plan: planId,
      plan_type: planId,
      tier: 'PRO',
    })
    .eq('id', params.userId)

  if (error) console.error('[stripe-webhook] grantFullAccess profile:', error)
}

/** Revoke FULL_ACCESS — cancel, past_due, expiry, or deletion. */
export async function revokeFullAccessForUser(params: {
  userId: string
  stripeCustomerId?: string | null
  status?: SaasSubscriptionStatus
}): Promise<void> {
  await upsertSaasSubscription({
    userId: params.userId,
    tier: 'FREE',
    status: params.status ?? 'canceled',
    currentPeriodStart: new Date(),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeCustomerId: params.stripeCustomerId ?? null,
    stripeSubscriptionId: null,
    fullAccess: false,
    stripePriceId: null,
  })

  const { error } = await getSupabaseAdmin()
    .from('profiles')
    .update({
      is_pro: false,
      is_elite: false,
      plan: 'free',
      plan_type: 'free',
      tier: 'FREE',
    })
    .eq('id', params.userId)

  if (error) console.error('[stripe-webhook] revokeFullAccess profile:', error)
}

export async function extractPrimaryPriceId(
  stripe: Stripe,
  subscriptionId: string,
): Promise<string | null> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const item = sub.items?.data?.[0]
  return typeof item?.price?.id === 'string' ? item.price.id : null
}

export async function isTwoTierFullAccessPrice(priceId: string | null | undefined): Promise<boolean> {
  if (!priceId) return false
  return isFullAccessStripePriceId(priceId)
}
