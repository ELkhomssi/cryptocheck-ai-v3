import { cache } from 'react'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { isSentinelQaBypassUserId } from '@/lib/config/sentinel-qa-bypass'
import type { SubscriptionTier } from '@/lib/types/tier'
import type { SaasSubscriptionRow, SaasTier } from '@/lib/types/saas-subscription'
import { mapSaasTierToRuntime } from '@/lib/services/saas-subscription.service'
import { resolveConsumerTier, type ConsumerTier } from '@/lib/billing/consumer-tier'

function consumerTierToSaasTier(t: ConsumerTier): SaasTier {
  if (t === 'free') return 'FREE'
  if (t === 'enterprise') return 'ENTERPRISE'
  if (t === 'elite') return 'PRO_MAX_ELITE'
  if (t === 'pro') return 'PRO'
  if (t === 'micropack') return 'PRO'
  return 'FREE'
}

/**
 * SENTINEL — subscription row for a user.
 * Loads the latest **`saas_subscriptions`** row (Stripe) for billing metadata, but **`effectiveTier` / `runtimeTier`**
 * follow **`resolveConsumerTier`** (profiles + entitled SaaS), same as consumer APIs.
 */
export type UserSubscription = {
  userId: string
  /** Raw row if present */
  record: SaasSubscriptionRow | null
  /** Merged tier (profiles + SaaS); maps to canonical `SaasTier` labels. */
  effectiveTier: SaasTier
  /** Maps to runtime quota keys (`institutional` for ENTERPRISE) */
  runtimeTier: SubscriptionTier
  /** `true` when there is no row in `saas_subscriptions` */
  isDefaultFree: boolean
}

/**
 * Fetches the user's SaaS row and merged tier for dashboard/API.
 * Memoized per request so layout + page + usage bundle share one DB round-trip set.
 */
async function getUserSubscriptionImpl(userId: string): Promise<UserSubscription> {
  if (isSentinelQaBypassUserId(userId)) {
    return {
      userId,
      record: null,
      effectiveTier: 'ENTERPRISE',
      runtimeTier: 'institutional',
      isDefaultFree: false,
    }
  }

  const sb = getSupabaseAdmin()
  const [{ data, error }, merged] = await Promise.all([
    sb
      .from('saas_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    resolveConsumerTier(userId),
  ])

  const effectiveTier = consumerTierToSaasTier(merged)
  const runtimeTier: SubscriptionTier = mapSaasTierToRuntime(effectiveTier)

  if (error || !data) {
    return {
      userId,
      record: null,
      effectiveTier,
      runtimeTier,
      isDefaultFree: true,
    }
  }

  const row = data as SaasSubscriptionRow

  return {
    userId,
    record: row,
    effectiveTier,
    runtimeTier,
    isDefaultFree: false,
  }
}

export const getUserSubscription = cache(getUserSubscriptionImpl)
