import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { SubscriptionTier } from '@/lib/types/tier'
import type { SaasSubscriptionStatus, SaasTier } from '@/lib/types/saas-subscription'

/** Maps DB ENUM to existing rate-limit / quota tier keys (ENTERPRISE → runtime `institutional`). */
export function mapSaasTierToRuntime(tier: SaasTier): SubscriptionTier {
  if (tier === 'ENTERPRISE') return 'institutional'
  if (tier === 'PRO') return 'pro'
  return 'free'
}

const ENTITLED: SaasSubscriptionStatus[] = ['active', 'trialing', 'past_due']

/**
 * Returns the latest SaaS entitlement row that still grants product access.
 */
export async function getActiveSaasSubscription(userId: string) {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('saas_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ENTITLED)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data
}

/**
 * Idempotent upsert by `user_id` (one SENTINEL entitlement row per user).
 */
export async function upsertSaasSubscription(input: {
  userId: string
  tier: SaasTier
  status: SaasSubscriptionStatus
  currentPeriodStart?: Date | null
  currentPeriodEnd?: Date | null
  cancelAtPeriodEnd?: boolean
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
}): Promise<void> {
  const sb = getSupabaseAdmin()
  const row = {
    user_id: input.userId,
    tier: input.tier,
    status: input.status,
    current_period_start: input.currentPeriodStart?.toISOString() ?? null,
    current_period_end: input.currentPeriodEnd?.toISOString() ?? null,
    cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await sb.from('saas_subscriptions').upsert(row, { onConflict: 'user_id' })
  if (error) throw error
}
