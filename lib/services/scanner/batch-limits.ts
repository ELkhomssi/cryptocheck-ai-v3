import type { SubscriptionTier } from '@/lib/types/tier'

/** SENTINEL batch caps: Free 5, Pro 20, Enterprise (institutional) 100 */
export function maxBatchSizeForTier(tier: SubscriptionTier): number {
  if (tier === 'institutional') return 100
  if (tier === 'pro') return 20
  return 5
}
