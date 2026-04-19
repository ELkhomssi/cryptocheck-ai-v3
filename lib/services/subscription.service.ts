import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { isSentinelQaBypassUserId } from '@/lib/config/sentinel-qa-bypass'
import type { SubscriptionTier } from '@/lib/types/tier'
import { getActiveSaasSubscription, mapSaasTierToRuntime } from '@/lib/services/saas-subscription.service'
import type { SaasTier } from '@/lib/types/saas-subscription'

export type ProfileRow = {
  is_pro?: boolean | null
  plan?: string | null
  is_elite?: boolean | null
  credits?: number | null
}

/**
 * Tier resolution & credit semantics for monetization.
 * **SENTINEL:** `saas_subscriptions` is the source of truth when an entitled row exists;
 * otherwise falls back to `profiles` (legacy SOL checkout / older flows).
 */
export class SubscriptionService {
  resolveTier(row: ProfileRow | null | undefined): SubscriptionTier {
    if (!row) return 'free'
    const p = String(row.plan || '').toLowerCase()
    if (p === 'institutional' || p === 'enterprise') return 'institutional'
    if (row.is_pro || p === 'pro' || p === 'deep' || p === 'whale') return 'pro'
    return 'free'
  }

  async getTierForUser(userId: string): Promise<SubscriptionTier> {
    if (isSentinelQaBypassUserId(userId)) return 'institutional'
    const saas = await getActiveSaasSubscription(userId)
    if (saas?.tier) {
      return mapSaasTierToRuntime(saas.tier as SaasTier)
    }

    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('profiles')
      .select('is_pro, plan, is_elite')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return 'free'
    return this.resolveTier(data)
  }

  async getProfile(userId: string): Promise<ProfileRow | null> {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) return null
    return data
  }

  /** Credit cost per scan / API unit — extend per feature as products grow. */
  creditCostForScan(tier: SubscriptionTier): number {
    if (tier === 'institutional') return 0
    if (tier === 'pro') return 0
    return 1
  }
}

export const subscriptionService = new SubscriptionService()
