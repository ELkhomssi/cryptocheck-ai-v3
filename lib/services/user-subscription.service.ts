import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { SubscriptionTier } from '@/lib/types/tier'
import type { SaasSubscriptionRow, SaasTier, SaasSubscriptionStatus } from '@/lib/types/saas-subscription'
import { mapSaasTierToRuntime } from '@/lib/services/saas-subscription.service'

const ENTITLED: SaasSubscriptionStatus[] = ['active', 'trialing', 'past_due']

/**
 * SENTINEL — subscription row for a user.
 * Reads **`saas_subscriptions`** (recurring SaaS). Legacy table `subscriptions` is for on-chain payment receipts only.
 */
export type UserSubscription = {
  userId: string
  /** Raw row if present */
  record: SaasSubscriptionRow | null
  /**
   * Tier used for entitlements when no row or row is not entitled — **`FREE`**.
   */
  effectiveTier: SaasTier
  /** Maps to runtime quota keys (`institutional` for ENTERPRISE) */
  runtimeTier: SubscriptionTier
  /** `true` when there is no row in `saas_subscriptions` */
  isDefaultFree: boolean
}

/**
 * Fetches the user's subscription record. Defaults to **FREE** when absent or not entitled.
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('saas_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return {
      userId,
      record: null,
      effectiveTier: 'FREE',
      runtimeTier: 'free',
      isDefaultFree: true,
    }
  }

  const row = data as SaasSubscriptionRow
  const entitled = ENTITLED.includes(row.status)
  const effectiveTier: SaasTier = entitled ? row.tier : 'FREE'

  return {
    userId,
    record: row,
    effectiveTier,
    runtimeTier: mapSaasTierToRuntime(effectiveTier),
    isDefaultFree: false,
  }
}
