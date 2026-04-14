import { createClient } from '@/lib/supabase/server'
import { subscriptionService } from '@/lib/services/subscription.service'
import { isProOrInstitutional } from '@/lib/auth/pro-feature-access'
import type { ProDashboardSession } from '@/lib/types/pro-dashboard'

export type { ProDashboardSession }

export async function getProDashboardSession(): Promise<ProDashboardSession> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { userId: null, email: null, tier: 'free', hasDeepAccess: false }
  }
  const tier = await subscriptionService.getTierForUser(user.id)
  return {
    userId: user.id,
    email: user.email ?? null,
    tier,
    hasDeepAccess: isProOrInstitutional(tier),
  }
}
