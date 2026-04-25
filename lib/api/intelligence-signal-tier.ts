/** Rate limits for GET /api/v1/intelligence/signals/[mint] — keys are normalized tier slugs. */
export const SIGNAL_TIER_LIMITS = {
  free: { allowed: false as const },
  micropack: { allowed: false as const },
  pro: { allowed: true as const, callsPerDay: 20 },
  elite: { allowed: true as const, callsPerDay: 100 },
  developer: { allowed: true as const, callsPerDay: 50 },
  enterprise: { allowed: true as const, callsPerDay: 1000 },
} as const

export type SignalTierKey = keyof typeof SIGNAL_TIER_LIMITS

/**
 * Maps `profiles.tier` (any casing / product string) to a SIGNAL_TIER_LIMITS key.
 * Prevents undefined access when DB stores `PRO`, `PRO_MAX_ELITE`, etc.
 */
export function normalizeProfileTierForSignals(raw: string | null | undefined): SignalTierKey {
  const u = String(raw ?? 'free')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')

  if (u === 'enterprise' || u === 'institutional') return 'enterprise'
  if (u === 'elite' || u === 'pro_max_elite') return 'elite'
  if (u === 'developer' || u === 'dev') return 'developer'
  if (u === 'pro' || u === 'pro_max_deep' || u === 'deep' || u === 'whale' || u === 'starter') return 'pro'
  if (u === 'micropack' || u === 'micro_pack') return 'micropack'
  return 'free'
}

export function getSignalLimitsForProfileTier(raw: string | null | undefined) {
  const key = normalizeProfileTierForSignals(raw)
  return { key, limits: SIGNAL_TIER_LIMITS[key] }
}
