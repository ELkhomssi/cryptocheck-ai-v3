export type SubscriptionTier = 'free' | 'pro' | 'institutional'

/** Sliding-window limits per tier (requests per window) — abuse protection on API keys. */
export const TIER_RATE_LIMITS: Record<
  SubscriptionTier,
  { maxRequests: number; windowSeconds: number }
> = {
  free: { maxRequests: 5, windowSeconds: 1 },
  pro: { maxRequests: 50, windowSeconds: 1 },
  institutional: { maxRequests: 200, windowSeconds: 1 },
}

/**
 * Developer API — rolling daily quota per API key (UTC day) or session user.
 * Enterprise / institutional: effectively unlimited (large cap).
 */
export const TIER_DAILY_API_LIMITS: Record<SubscriptionTier, { maxRequests: number }> = {
  free: { maxRequests: 10 },
  pro: { maxRequests: 1_000 },
  institutional: { maxRequests: 10_000_000 },
}
