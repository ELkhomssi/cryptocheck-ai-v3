import { getActiveSaasSubscription } from '@/lib/services/saas-subscription.service'
import { isSentinelQaBypassUserId, sentinelQaBypassEnabled } from '@/lib/config/sentinel-qa-bypass'
import type { SaasSubscriptionStatus } from '@/lib/types/saas-subscription'

const GRANTING_STATUSES = new Set<SaasSubscriptionStatus>(['active', 'trialing'])

const LEGACY_PAID_TIERS = new Set(['PRO', 'PRO_MAX_DEEP', 'PRO_MAX_ELITE', 'ENTERPRISE'])

function periodStillValid(periodEnd: string | null | undefined): boolean {
  if (!periodEnd) return true
  return new Date(periodEnd).getTime() > Date.now()
}

/**
 * Server-side FULL_ACCESS — Deep Neural Scans, Alpha Feed, AI Auto-Sniper (UI access only).
 * Derived from webhook-updated `saas_subscriptions.full_access` or legacy paid tier.
 */
export async function userHasFullPlatformAccess(userId: string): Promise<boolean> {
  if (sentinelQaBypassEnabled() && isSentinelQaBypassUserId(userId)) return true

  const row = await getActiveSaasSubscription(userId)
  if (!row) return false

  const status = String(row.status ?? '').toLowerCase() as SaasSubscriptionStatus
  if (!GRANTING_STATUSES.has(status)) return false
  if (!periodStillValid(row.current_period_end as string | null)) return false

  if (row.full_access === true) return true

  const tier = String(row.tier ?? '').toUpperCase()
  return LEGACY_PAID_TIERS.has(tier)
}

export type FullAccessSnapshot = {
  fullAccess: boolean
  status: string | null
  stripePriceId: string | null
  currentPeriodEnd: string | null
}

export async function getFullAccessSnapshot(userId: string): Promise<FullAccessSnapshot> {
  const row = await getActiveSaasSubscription(userId)
  const fullAccess = await userHasFullPlatformAccess(userId)
  return {
    fullAccess,
    status: row?.status != null ? String(row.status) : null,
    stripePriceId: (row?.stripe_price_id as string | null) ?? null,
    currentPeriodEnd: (row?.current_period_end as string | null) ?? null,
  }
}
