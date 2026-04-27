import { unstable_cache } from 'next/cache'
import { getDashboardUsageBundle } from '@/lib/services/usage-analytics.service'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { StreamEvent } from '@/components/Dashboard/ActivityStream'

/**
 * Per-user cached dashboard usage bundle to reduce repeat query pressure
 * while preserving force-dynamic page behavior.
 */
const getDashboardUsageBundleCachedInner = unstable_cache(
  async (userId: string, days: number) => getDashboardUsageBundle(userId, days),
  ['dashboard-usage-bundle-v1'],
  { revalidate: 60 }
)

/**
 * Per-user cached recent security stream rows for dashboard sidebar.
 */
const getRecentSecurityRowsCachedInner = unstable_cache(
  async (userId: string) => {
    const sb = getSupabaseAdmin()
    const { data } = await sb
      .from('security_logs')
      .select('id, action, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(14)

    return (data ?? []).map((r) => ({
      id: String((r as { id?: unknown }).id ?? ''),
      action: String((r as { action?: unknown }).action ?? ''),
      created_at: String((r as { created_at?: unknown }).created_at ?? ''),
    })) as StreamEvent[]
  },
  ['dashboard-security-stream-v1'],
  { revalidate: 30 }
)

export async function getCachedDashboardUsageBundle(userId: string, days: number) {
  return getDashboardUsageBundleCachedInner(userId, days)
}

export async function getCachedRecentSecurityRows(userId: string): Promise<StreamEvent[]> {
  return getRecentSecurityRowsCachedInner(userId)
}

