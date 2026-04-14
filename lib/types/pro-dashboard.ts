import type { SubscriptionTier } from '@/lib/types/tier'

export type ProDashboardSession = {
  userId: string | null
  email: string | null
  tier: SubscriptionTier
  hasDeepAccess: boolean
}
