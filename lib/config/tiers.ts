/** Runtime subscription tier keys — keep aligned with `@/lib/types/tier` `SubscriptionTier`. */
export type TierKey = 'free' | 'pro' | 'institutional'

/**
 * Institutional API — single source of truth for SENTINEL limits (rate + daily quota).
 * `institutional` maps to product ENTERPRISE / institutional entitlements.
 */
export const TIER_RATE_LIMITS: Record<TierKey, { maxRequests: number; windowSeconds: number }> = {
  free: { maxRequests: 5, windowSeconds: 1 },
  pro: { maxRequests: 50, windowSeconds: 1 },
  institutional: { maxRequests: 200, windowSeconds: 1 },
}

/** Rolling daily cap per API key identity (UTC calendar day). */
export const TIER_DAILY_API_LIMITS: Record<TierKey, { maxRequests: number }> = {
  free: { maxRequests: 10 },
  pro: { maxRequests: 1_000 },
  /** Enterprise — realistic cap (simulates contract quotas). */
  institutional: { maxRequests: 5_000 },
}
