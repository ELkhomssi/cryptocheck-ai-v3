/**
 * Canonical consumer / SaaS tier strings and strict ordering.
 * Hierarchy: FREE < PRO < PRO_MAX_DEEP < PRO_MAX_ELITE < ENTERPRISE
 */

export const CANONICAL_SAAS_TIERS = [
  'FREE',
  'PRO',
  'PRO_MAX_DEEP',
  'PRO_MAX_ELITE',
  'ENTERPRISE',
] as const

export type CanonicalSaasTier = (typeof CANONICAL_SAAS_TIERS)[number]

export function normalizeTierLabel(raw: string | null | undefined): CanonicalSaasTier {
  const u = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (u === 'ENTERPRISE' || u === 'INSTITUTIONAL') return 'ENTERPRISE'
  if (u === 'PRO_MAX_ELITE' || u === 'ELITE') return 'PRO_MAX_ELITE'
  if (u === 'PRO_MAX_DEEP' || u === 'DEEP') return 'PRO_MAX_DEEP'
  if (u === 'PRO' || u === 'WHALE' || u === 'MICROPACK' || u === 'STARTER') return 'PRO'
  if (u === 'FREE') return 'FREE'
  return 'FREE'
}

/** Rank for merging profile + SaaS (higher = more entitlement). */
export function canonicalTierRank(c: CanonicalSaasTier): number {
  if (c === 'ENTERPRISE') return 5
  if (c === 'PRO_MAX_ELITE') return 4
  if (c === 'PRO_MAX_DEEP') return 3
  if (c === 'PRO') return 2
  return 0
}

export function mergeCanonicalTiers(a: string | null | undefined, b: string | null | undefined): CanonicalSaasTier {
  const ca = normalizeTierLabel(a)
  const cb = normalizeTierLabel(b)
  return canonicalTierRank(ca) >= canonicalTierRank(cb) ? ca : cb
}

/** Map merged numeric rank back to the canonical tier label. */
export function clampCanonicalFromRank(r: number): CanonicalSaasTier {
  if (r >= 5) return 'ENTERPRISE'
  if (r >= 4) return 'PRO_MAX_ELITE'
  if (r >= 3) return 'PRO_MAX_DEEP'
  if (r >= 2) return 'PRO'
  return 'FREE'
}
