import { createHash } from 'node:crypto'
import { ALL_ALERT_TYPES } from '@/lib/portfolio-desk/alert-classify'
import type { AlertPreference, PortfolioAlertType } from '@/types/portfolio-desk'

/** Pure helpers are client-safe; Supabase I/O only runs on the server. */

/**
 * Stable UUID for wallet-only desk users (no Supabase session).
 * Satisfies UNIQUE(user_id, alert_type) without inventing random ids.
 */
export function preferenceUserId(opts: {
  sessionUserId?: string | null
  wallet?: string | null
}): string | null {
  if (opts.sessionUserId && opts.sessionUserId.length >= 32) return opts.sessionUserId
  const w = opts.wallet?.trim()
  if (!w || w.length < 32) return null
  const hex = createHash('sha256').update(`ccai:term:pref:${w}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function hasAdminEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

function defaultPrefs(): AlertPreference[] {
  return ALL_ALERT_TYPES.map((alertType) => ({ alertType, enabled: true }))
}

/** Merge DB rows with full type list (missing types default enabled). */
function mergePrefs(rows: { alert_type: string; enabled: boolean }[]): AlertPreference[] {
  const map = new Map<string, boolean>()
  for (const r of rows) map.set(r.alert_type, Boolean(r.enabled))
  return ALL_ALERT_TYPES.map((alertType) => ({
    alertType,
    enabled: map.has(alertType) ? Boolean(map.get(alertType)) : true,
  }))
}

export async function getAlertPreferences(userId: string): Promise<AlertPreference[]> {
  if (!hasAdminEnv()) return defaultPrefs()
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('terminal_alert_preferences')
      .select('alert_type,enabled')
      .eq('user_id', userId)
    if (error || !data) return defaultPrefs()
    return mergePrefs(data)
  } catch {
    return defaultPrefs()
  }
}

export async function setAlertPreferences(opts: {
  userId: string
  wallet?: string | null
  preferences: AlertPreference[]
}): Promise<AlertPreference[]> {
  const wallet = opts.wallet?.trim() ?? ''
  const cleaned = opts.preferences.filter((p) =>
    ALL_ALERT_TYPES.includes(p.alertType as PortfolioAlertType),
  )
  if (!hasAdminEnv()) {
    return mergePrefs(
      cleaned.map((p) => ({ alert_type: p.alertType, enabled: p.enabled })),
    )
  }
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const sb = getSupabaseAdmin()
    const now = new Date().toISOString()
    const rows = cleaned.map((p) => ({
      user_id: opts.userId,
      wallet,
      alert_type: p.alertType,
      enabled: p.enabled,
      updated_at: now,
    }))
    if (rows.length) {
      await sb.from('terminal_alert_preferences').upsert(rows, {
        onConflict: 'user_id,alert_type',
      })
    }
    return getAlertPreferences(opts.userId)
  } catch {
    return mergePrefs(
      cleaned.map((p) => ({ alert_type: p.alertType, enabled: p.enabled })),
    )
  }
}

export function enabledTypeSet(prefs: AlertPreference[]): Set<PortfolioAlertType> {
  return new Set(prefs.filter((p) => p.enabled).map((p) => p.alertType))
}
