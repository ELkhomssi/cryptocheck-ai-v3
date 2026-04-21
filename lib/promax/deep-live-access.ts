import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getActiveSaasSubscription } from '@/lib/services/saas-subscription.service'
import { hasAccess, type AccessContext } from '@/lib/access-control'

/**
 * Live chain fusion for Pro Max Deep dashboard — reads tiers only (Stripe unchanged).
 * Elite band (e.g. ENTERPRISE / PRO_MAX_ELITE in DB) also qualifies via `deep_chain_intel`.
 */
export async function userHasDeepLiveIntel(userId: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  const { data: p } = await sb.from('profiles').select('tier').eq('id', userId).maybeSingle()
  const saas = await getActiveSaasSubscription(userId)
  const ctx: AccessContext = { profileTier: p?.tier ?? null, saasTier: saas?.tier ?? null }
  return hasAccess(ctx, 'deep_chain_intel')
}
