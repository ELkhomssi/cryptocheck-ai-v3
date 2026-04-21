/**
 * Client-safe subscription flags from `profiles` (+ optional entitled SaaS tier).
 * Canonical tiers: FREE < PRO < PRO_MAX_DEEP < PRO_MAX_ELITE < ENTERPRISE.
 * ENTERPRISE unlocks both Deep and Elite (no separate flags required).
 */

import {
  canonicalTierRank,
  clampCanonicalFromRank,
  normalizeTierLabel,
  type CanonicalSaasTier,
} from '@/lib/subscription/tier-ranks'

export type ProfileSubscriptionRow = {
  is_pro?: boolean | null
  plan?: string | null
  plan_type?: string | null
  tier?: string | null
  is_elite?: boolean | null
}

export type DisplaySubscriptionTier = CanonicalSaasTier

export type ClientSubscriptionFlags = {
  currentTier: DisplaySubscriptionTier
  /** Pro Max Deep features — PRO+ (includes PRO_MAX_DEEP path). */
  isDeepActive: boolean
  /** Pro Max Elite + ENTERPRISE surfaces. */
  isEliteActive: boolean
  /** Consumer Deep paywall bypass — same threshold as Deep. */
  hasFullAccess: boolean
}

const SAAS_ENTITLED = new Set(['active', 'trialing', 'past_due'])

function legacyRankFromProfile(row: ProfileSubscriptionRow): number {
  const p = String(row.plan || '').toLowerCase()
  const pt = String(row.plan_type ?? '').trim().toLowerCase()
  let m = 0
  if (p === 'institutional' || p === 'enterprise' || pt === 'institutional' || pt === 'enterprise') {
    m = Math.max(m, 5)
  } else if (row.is_elite || p === 'elite' || pt === 'elite' || pt === 'pro_max_elite') {
    m = Math.max(m, 4)
  } else if (p === 'deep' || pt === 'deep' || pt === 'pro_max_deep') {
    m = Math.max(m, 3)
  } else if (row.is_pro || p === 'pro' || p === 'whale' || pt === 'pro' || pt === 'whale') {
    m = Math.max(m, 2)
  }
  return m
}

function effectiveRankFromProfile(row: ProfileSubscriptionRow | null): number {
  if (!row) return 0
  const fromColumn = canonicalTierRank(normalizeTierLabel(row.tier))
  return Math.max(fromColumn, legacyRankFromProfile(row))
}

export type DeriveSubscriptionOpts = {
  /** Raw `saas_subscriptions.tier` when row is entitled. */
  saasTier?: string | null
  saasStatus?: string | null
}

/**
 * Derives UI flags from `profiles` and optionally an entitled SaaS row.
 * Uses max rank across sources (strict hierarchy).
 */
export function deriveClientSubscription(
  profile: ProfileSubscriptionRow | null,
  opts?: DeriveSubscriptionOpts
): ClientSubscriptionFlags {
  if (!profile && !(opts?.saasTier && opts?.saasStatus && SAAS_ENTITLED.has(String(opts.saasStatus).toLowerCase()))) {
    return {
      currentTier: 'FREE',
      isDeepActive: false,
      isEliteActive: false,
      hasFullAccess: false,
    }
  }

  let r = profile ? effectiveRankFromProfile(profile) : 0

  const st = String(opts?.saasStatus ?? '').toLowerCase()
  if (opts?.saasTier && SAAS_ENTITLED.has(st)) {
    r = Math.max(r, canonicalTierRank(normalizeTierLabel(opts.saasTier)))
  }

  const currentTier = clampCanonicalFromRank(r)

  const isDeepActive = r >= 2
  const isEliteActive = r >= 4
  const hasFullAccess = r >= 2

  return { currentTier, isDeepActive, isEliteActive, hasFullAccess }
}
