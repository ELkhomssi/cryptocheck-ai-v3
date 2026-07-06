import { createClient } from '@/lib/supabase/server'
import { subscriptionService } from '@/lib/services/subscription.service'
import { userHasFullPlatformAccess } from '@/lib/billing/full-access'
import type { ProDashboardSession } from '@/lib/types/pro-dashboard'

export type { ProDashboardSession }

/** Institutional `/pro/dashboard` — grants access for PRO or ENTERPRISE (normalized `institutional`). */
export async function getProDashboardSession(): Promise<ProDashboardSession> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { userId: null, email: null, tier: 'free', hasDeepAccess: false }
  }
  const tier = await subscriptionService.getTierForUser(user.id)
  const hasDeepAccess = await userHasFullPlatformAccess(user.id)
  return {
    userId: user.id,
    email: user.email ?? null,
    tier,
    hasDeepAccess,
  }
}
