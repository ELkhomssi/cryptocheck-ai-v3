import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type ConsumerTier = 'free' | 'micropack' | 'pro' | 'elite'

type ProfileTierRow = {
  tier?: string | null
  plan?: string | null
  is_pro?: boolean | null
  is_elite?: boolean | null
}

type SaasTierRow = {
  tier?: string | null
  status?: string | null
}

const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due'])

function normalizeProfileTier(row: ProfileTierRow | null): ConsumerTier | null {
  if (!row) return null

  const direct = String(row.tier ?? '').trim().toLowerCase()
  if (direct === 'free') return 'free'
  if (direct === 'micropack' || direct === 'starter') return 'micropack'
  if (direct === 'pro' || direct === 'deep') return 'pro'
  if (direct === 'elite' || direct === 'enterprise' || direct === 'institutional') return 'elite'

  const plan = String(row.plan ?? '').trim().toLowerCase()
  if (plan === 'starter' || plan === 'micropack') return 'micropack'
  if (plan === 'deep' || plan === 'pro' || plan === 'whale') return 'pro'
  if (plan === 'elite' || plan === 'enterprise' || plan === 'institutional') return 'elite'
  if (row.is_elite) return 'elite'
  if (row.is_pro) return 'pro'
  return null
}

function normalizeSaasTier(row: SaasTierRow | null): ConsumerTier | null {
  if (!row) return null
  const status = String(row.status ?? '').trim().toLowerCase()
  if (!ENTITLED_STATUSES.has(status)) return null
  const tier = String(row.tier ?? '').trim().toUpperCase()
  if (tier === 'ENTERPRISE') return 'elite'
  if (tier === 'PRO') return 'pro'
  if (tier === 'FREE') return 'free'
  return null
}

/**
 * Resolve user tier with legacy consumer profile fields plus SaaS fallback.
 */
export async function resolveConsumerTier(userId: string): Promise<ConsumerTier> {
  const sb = getSupabaseAdmin()

  const [{ data: profile }, { data: saas }] = await Promise.all([
    sb.from('profiles').select('tier, plan, is_pro, is_elite').eq('id', userId).maybeSingle(),
    sb
      .from('saas_subscriptions')
      .select('tier, status, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const profileTier = normalizeProfileTier((profile as ProfileTierRow | null) ?? null)
  const saasTier = normalizeSaasTier((saas as SaasTierRow | null) ?? null)

  if (profileTier === 'elite') return 'elite'
  if (profileTier === 'pro' && saasTier !== 'elite') return 'pro'
  if (profileTier === 'micropack' && !saasTier) return 'micropack'

  if (saasTier) return saasTier
  if (profileTier) return profileTier
  return 'free'
}
