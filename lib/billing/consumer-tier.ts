import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'

/** `enterprise` = ENTERPRISE / institutional; `elite` = PRO_MAX_ELITE band. */
export type ConsumerTier = 'free' | 'micropack' | 'pro' | 'elite' | 'enterprise'

type ProfileTierRow = {
  tier?: string | null
  plan?: string | null
  /** Stripe / legacy SQL often writes here while `plan` stays a display slug */
  plan_type?: string | null
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
  if (direct === 'pro_max_deep' || direct === 'deep') return 'pro'
  if (direct === 'pro' || direct === 'whale') return 'pro'
  if (direct === 'pro_max_elite' || direct === 'elite') return 'elite'
  if (direct === 'enterprise' || direct === 'institutional') return 'enterprise'

  const plan = String(row.plan ?? '').trim().toLowerCase()
  const planType = String(row.plan_type ?? '').trim().toLowerCase()
  if (plan === 'starter' || plan === 'micropack' || planType === 'starter' || planType === 'micropack') return 'micropack'
  if (plan === 'deep' || planType === 'deep' || planType === 'pro_max_deep') return 'pro'
  if (plan === 'pro' || plan === 'whale' || planType === 'pro' || planType === 'whale') return 'pro'
  if (plan === 'elite' || planType === 'elite' || planType === 'pro_max_elite') return 'elite'
  if (plan === 'enterprise' || plan === 'institutional' || planType === 'enterprise' || planType === 'institutional')
    return 'enterprise'
  if (row.is_elite) return 'elite'
  if (row.is_pro) return 'pro'
  return null
}

function normalizeSaasTier(row: SaasTierRow | null): ConsumerTier | null {
  if (!row) return null
  const status = String(row.status ?? '').trim().toLowerCase()
  if (!ENTITLED_STATUSES.has(status)) return null
  const tier = String(row.tier ?? '').trim().toUpperCase()
  if (tier === 'ENTERPRISE') return 'enterprise'
  if (tier === 'PRO_MAX_ELITE') return 'elite'
  if (tier === 'PRO_MAX_DEEP') return 'pro'
  if (tier === 'PRO') return 'pro'
  if (tier === 'FREE') return 'free'
  return null
}

function consumerRank(t: ConsumerTier): number {
  if (t === 'enterprise') return 4
  if (t === 'elite') return 3
  if (t === 'pro') return 2
  if (t === 'micropack') return 1
  return 0
}

function maxConsumer(a: ConsumerTier, b: ConsumerTier | null): ConsumerTier {
  if (!b) return a
  return consumerRank(a) >= consumerRank(b) ? a : b
}

/**
 * Resolve user tier with legacy consumer profile fields plus SaaS fallback.
 */
export async function resolveConsumerTier(userId: string): Promise<ConsumerTier> {
  const sb = getSupabaseAdmin()

  const [{ data: profile }, { data: saas }] = await Promise.all([
    sb.from('profiles').select('tier, plan, plan_type, is_pro, is_elite').eq('id', userId).maybeSingle(),
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

  let out: ConsumerTier = 'free'
  out = maxConsumer(out, profileTier)
  out = maxConsumer(out, saasTier)
  return out
}
