/**
 * SENTINEL SaaS — persisted tier labels (database CHECK constraints).
 * Maps to runtime `SubscriptionTier` via `mapSaasTierToRuntime`.
 * Hierarchy: FREE < PRO < PRO_MAX_DEEP < PRO_MAX_ELITE < ENTERPRISE
 */
export type SaasTier =
  | 'FREE'
  | 'PRO'
  | 'PRO_MAX_DEEP'
  | 'PRO_MAX_ELITE'
  | 'ENTERPRISE'

export type SaasSubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled'

export type SaasSubscriptionRow = {
  id: string
  user_id: string
  tier: SaasTier
  status: SaasSubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  full_access?: boolean | null
  stripe_price_id?: string | null
}
