import { getUserSubscription } from '@/lib/services/user-subscription.service'

export async function canUseInstitutionalWebhooks(userId: string): Promise<boolean> {
  const sub = await getUserSubscription(userId)
  return sub.effectiveTier === 'ENTERPRISE'
}
