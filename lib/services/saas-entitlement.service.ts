import { getActiveSaasSubscription, upsertSaasSubscription } from '@/lib/services/saas-subscription.service'
import { isSentinelQaBypassUserId, sentinelQaBypassEnabled } from '@/lib/config/sentinel-qa-bypass'

/**
 * Active `saas_subscriptions` row (FREE/PRO/ENTERPRISE with entitled status) is required for product/API access.
 */
export async function userEntitledForProductAccess(userId: string): Promise<boolean> {
  if (sentinelQaBypassEnabled() && isSentinelQaBypassUserId(userId)) return true
  const row = await getActiveSaasSubscription(userId)
  return row != null
}

/**
 * Idempotent: every registered user gets an explicit FREE entitlement (no payment).
 * Call after profile creation / sync.
 */
export async function ensureFreeTierSubscription(userId: string): Promise<void> {
  const existing = await getActiveSaasSubscription(userId)
  if (existing) return
  await upsertSaasSubscription({
    userId,
    tier: 'FREE',
    status: 'active',
    currentPeriodStart: new Date(),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  })
}
