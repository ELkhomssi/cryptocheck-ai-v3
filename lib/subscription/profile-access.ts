/**
 * Client-safe subscription flags from `profiles` row (same signals as consumer dashboard).
 * ENTERPRISE / institutional / is_elite → superset of PRO for UI gating.
 */

export type ProfileSubscriptionRow = {
  is_pro?: boolean | null
  plan?: string | null
  plan_type?: string | null
  tier?: string | null
  is_elite?: boolean | null
}

export type DisplaySubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE'

export type ClientSubscriptionFlags = {
  currentTier: DisplaySubscriptionTier
  /** Pro Max Deep ($30) and API depth — true for PRO or ENTERPRISE. */
  isDeepActive: boolean
  /** Elite / institutional surface — true for ENTERPRISE, institutional, or is_elite. */
  isEliteActive: boolean
  /** Bypass consumer Deep paywall — true for any paid deep tier (PRO or ENTERPRISE). */
  hasFullAccess: boolean
}

export function deriveClientSubscription(row: ProfileSubscriptionRow | null): ClientSubscriptionFlags {
  if (!row) {
    return {
      currentTier: 'FREE',
      isDeepActive: false,
      isEliteActive: false,
      hasFullAccess: false,
    }
  }

  const p = String(row.plan || '').toLowerCase()
  const pt = String(row.plan_type ?? '').trim().toLowerCase()
  const tierRaw = String(row.tier ?? '').trim()
  const tier = tierRaw.toLowerCase()
  const tierU = tierRaw.toUpperCase()

  const enterpriseLike =
    tierU === 'ENTERPRISE' ||
    tier === 'enterprise' ||
    tier === 'institutional' ||
    tier === 'elite' ||
    !!row.is_elite ||
    p === 'institutional' ||
    p === 'enterprise' ||
    p === 'elite' ||
    pt === 'institutional' ||
    pt === 'enterprise' ||
    pt === 'elite'

  const proDeepLike =
    !!row.is_pro ||
    p === 'pro' ||
    p === 'deep' ||
    p === 'whale' ||
    pt === 'pro' ||
    pt === 'deep' ||
    pt === 'whale' ||
    tierU === 'PRO' ||
    tier === 'micropack' ||
    tier === 'starter' ||
    tier === 'pro' ||
    tier === 'deep' ||
    tier === 'whale'

  const isDeepActive = enterpriseLike || proDeepLike
  const isEliteActive = enterpriseLike
  const hasFullAccess = isDeepActive
  const currentTier: DisplaySubscriptionTier = enterpriseLike
    ? 'ENTERPRISE'
    : proDeepLike
      ? 'PRO'
      : 'FREE'

  return { currentTier, isDeepActive, isEliteActive, hasFullAccess }
}
