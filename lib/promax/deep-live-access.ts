import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getActiveSaasSubscription } from '@/lib/services/saas-subscription.service'

/**
 * Live Pro Max Deep chain intel — only ENTERPRISE and PRO_MAX_DEEP (canonical DB tiers).
 */
export async function userHasDeepLiveIntel(userId: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  const { data: p } = await sb.from('profiles').select('tier').eq('id', userId).maybeSingle()
  const pt = String(p?.tier ?? '').trim().toUpperCase()
  if (pt === 'ENTERPRISE' || pt === 'PRO_MAX_DEEP') return true

  const saas = await getActiveSaasSubscription(userId)
  const st = String(saas?.tier ?? '').trim().toUpperCase()
  return st === 'ENTERPRISE' || st === 'PRO_MAX_DEEP'
}
