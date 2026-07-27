/**
 * Phase 18 — entitlements helper.
 * Free vs Pro feature gates. Shared source of truth: public.entitlements.
 */

import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type EntitlementFeature =
  | 'scheduled_reports'
  | 'automation'
  | 'launchlab_create'
  | 'recommendations_full'
  | 'higher_rate_limits'

export type EntitlementPlan = 'free' | 'pro'

const PRO_FEATURES = new Set<EntitlementFeature>([
  'scheduled_reports',
  'automation',
  'launchlab_create',
  'recommendations_full',
  'higher_rate_limits',
])

export const FEATURE_UNLOCK_COPY: Record<EntitlementFeature, string> = {
  scheduled_reports:
    'Scheduled Daily / Weekly / Monthly reports are included with Pro — upgrade to keep automatic briefs running.',
  automation:
    'Automation schedules are included with Pro — upgrade to let agents run on a schedule for you.',
  launchlab_create:
    'LaunchLab token creation is included with Pro — upgrade to prepare and launch tokens.',
  recommendations_full:
    'Full Recommendation Engine output is included with Pro — upgrade for denser, grounded priorities.',
  higher_rate_limits:
    'Higher Command Center and intelligence rate limits are included with Pro.',
}

export type EntitlementRow = {
  userId: string
  plan: EntitlementPlan
  status: string
  currentPeriodEnd: string | null
  source: string
}

export async function getEntitlement(userId: string): Promise<EntitlementRow | null> {
  if (!userId.trim()) return null
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('entitlements')
      .select('user_id, plan, status, current_period_end, source')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null
    return {
      userId: String(data.user_id),
      plan: (String(data.plan || 'free') as EntitlementPlan) || 'free',
      status: String(data.status || 'active'),
      currentPeriodEnd: (data.current_period_end as string | null) ?? null,
      source: String(data.source || 'system'),
    }
  } catch {
    return null
  }
}

function periodActive(row: EntitlementRow): boolean {
  const okStatus = row.status === 'active' || row.status === 'trialing'
  if (!okStatus) return false
  if (!row.currentPeriodEnd) return row.plan === 'free' || row.plan === 'pro'
  return new Date(row.currentPeriodEnd).getTime() > Date.now()
}

export async function isEntitled(
  userId: string,
  feature: EntitlementFeature,
): Promise<boolean> {
  if (!PRO_FEATURES.has(feature)) return true
  const row = await getEntitlement(userId)
  if (!row) return false // no row → treat as free without Pro features
  if (!periodActive(row)) return false
  return row.plan === 'pro'
}

export async function upsertEntitlement(params: {
  userId: string
  plan: EntitlementPlan
  status?: string
  currentPeriodEnd?: string | null
  source?: string
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
}): Promise<void> {
  const admin = getSupabaseAdmin()
  await admin.from('entitlements').upsert(
    {
      user_id: params.userId,
      plan: params.plan,
      status: params.status ?? 'active',
      current_period_end: params.currentPeriodEnd ?? null,
      source: params.source ?? 'system',
      stripe_customer_id: params.stripeCustomerId ?? null,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
}

export function entitlementDeniedBody(feature: EntitlementFeature) {
  return {
    error: 'pro_required',
    feature,
    message: FEATURE_UNLOCK_COPY[feature],
    upgradePath: '/api/billing/pro-checkout',
  }
}
