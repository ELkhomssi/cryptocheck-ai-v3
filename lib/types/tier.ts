export type SubscriptionTier = 'free' | 'pro' | 'institutional'

/** Sliding-window limits per tier (requests per window). */
export const TIER_RATE_LIMITS: Record<
  SubscriptionTier,
  { maxRequests: number; windowSeconds: number }
> = {
  free: { maxRequests: 5, windowSeconds: 1 },
  pro: { maxRequests: 50, windowSeconds: 1 },
  institutional: { maxRequests: 200, windowSeconds: 1 },
}
