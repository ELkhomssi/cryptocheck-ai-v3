import { getSupabase } from '@/lib/supabase'

export type FeatureType = 
  | 'neural_scan'
  | 'ai_prediction'
  | 'auto_sniper'
  | 'whale_intel'
  | 'forensics'
  | 'alpha_feed'

const FREE_FEATURES: FeatureType[] = ['neural_scan']
const PRO_FEATURES: FeatureType[]  = ['ai_prediction','auto_sniper','whale_intel','forensics','alpha_feed']

export interface UserAccess {
  isPro:       boolean
  isWhale:     boolean
  scansToday:  number
  scansLimit:  number
  plan:        'free'|'pro'|'whale'
}

export async function getUserAccess(): Promise<UserAccess> {
  try {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const isPro = typeof window !== 'undefined' && localStorage.getItem('cc_is_pro') === 'true'
      return { isPro, isWhale: false, scansToday: 0, scansLimit: isPro ? 999 : 10, plan: isPro ? 'pro' : 'free' }
    }
    const { data } = await supabase
      .from('profiles')
      .select('is_pro, plan, plan_type, tier, scans_today')
      .eq('id', user.id)
      .single()

    const p = String(data?.plan || '').toLowerCase()
    const pt = String(data?.plan_type ?? '').trim().toLowerCase()
    const tier = String(data?.tier ?? '').trim().toLowerCase()
    const tierPro =
      tier === 'micropack' ||
      tier === 'starter' ||
      tier === 'pro' ||
      tier === 'deep' ||
      tier === 'whale' ||
      tier === 'elite' ||
      tier === 'institutional' ||
      tier === 'enterprise'
    const isPro =
      !!data?.is_pro ||
      tierPro ||
      p === 'pro' ||
      p === 'deep' ||
      p === 'whale' ||
      p === 'elite' ||
      p === 'institutional' ||
      p === 'enterprise' ||
      pt === 'pro' ||
      pt === 'deep' ||
      pt === 'whale' ||
      pt === 'elite' ||
      pt === 'institutional' ||
      pt === 'enterprise'
    const isWhale = data?.plan === 'whale'
    return {
      isPro, isWhale,
      scansToday: data?.scans_today || 0,
      scansLimit: isPro ? 999 : 10,
      plan: (data?.plan as any) || 'free'
    }
  } catch {
    const isPro = typeof window !== 'undefined' && localStorage.getItem('cc_is_pro') === 'true'
    return { isPro, isWhale: false, scansToday: 0, scansLimit: isPro ? 999 : 10, plan: isPro ? 'pro' : 'free' }
  }
}

export function isFeatureLocked(access: UserAccess, feature: FeatureType): boolean {
  if (FREE_FEATURES.includes(feature)) return false
  if (access.isPro || access.isWhale) return false
  if (PRO_FEATURES.includes(feature)) return true
  return false
}

export async function deductScan(userId: string): Promise<{ success: boolean; remaining: number; error?: string }> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('profiles')
      .select('scans_today, is_pro, plan, plan_type, tier')
      .eq('id', userId)
      .single()

    if (error || !data) return { success: false, remaining: 0, error: 'Profile not found' }

    const p = String(data.plan || '').toLowerCase()
    const pt = String(data.plan_type ?? '').trim().toLowerCase()
    const tier = String(data.tier ?? '').trim().toLowerCase()
    const tierPro =
      tier === 'micropack' ||
      tier === 'starter' ||
      tier === 'pro' ||
      tier === 'deep' ||
      tier === 'whale' ||
      tier === 'elite' ||
      tier === 'institutional' ||
      tier === 'enterprise'
    const isPro =
      !!data.is_pro ||
      tierPro ||
      p === 'pro' ||
      p === 'deep' ||
      p === 'whale' ||
      p === 'elite' ||
      p === 'institutional' ||
      p === 'enterprise' ||
      pt === 'pro' ||
      pt === 'deep' ||
      pt === 'whale' ||
      pt === 'elite' ||
      pt === 'institutional' ||
      pt === 'enterprise'
    const limit = isPro ? 9999 : 10

    if (data.scans_today >= limit) {
      return { success: false, remaining: 0, error: isPro ? 'Daily limit reached' : 'Upgrade to Pro for unlimited scans' }
    }

    await supabase
      .from('profiles')
      .update({ scans_today: data.scans_today + 1 })
      .eq('id', userId)

    return { success: true, remaining: limit - data.scans_today - 1 }
  } catch (e) {
    return { success: false, remaining: 0, error: String(e) }
  }
}
