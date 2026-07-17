import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type OperatorIdentity = {
  userId: string
  email: string | null
}

/** Temporary hard allow — remove after DIAGNOSTICS_ADMIN_EMAILS is set in Vercel prod. */
const FORCE_OPERATOR_EMAIL = 'elkhomssiabderrahim@gmail.com'

/** Temporary debug bypass — remove once gate is confirmed. */
const ADMIN_BYPASS_HEADER = 'x-admin-bypass'
const ADMIN_BYPASS_SECRET = 'secret-password-123'

async function hasAdminBypass(): Promise<boolean> {
  const h = await headers()
  return (h.get(ADMIN_BYPASS_HEADER) ?? '') === ADMIN_BYPASS_SECRET
}

/**
 * Same allowlist as assertDiagnosticsAdmin (session only — no Bearer on HTML pages).
 * FORCE_OPERATOR_EMAIL · @cryptocheckai.com · DIAGNOSTICS_ADMIN_EMAILS · ADMIN_WALLETS
 */
export async function isOperatorUser(userId: string, email: string | null | undefined): Promise<boolean> {
  const normalized = (email ?? '').toLowerCase().trim()
  if (normalized === FORCE_OPERATOR_EMAIL) return true

  const extra = (process.env.DIAGNOSTICS_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const domainOk = normalized.endsWith('@cryptocheckai.com')
  const listed = extra.length > 0 && extra.includes(normalized)
  if (domainOk || listed) return true

  const adminWallets = (process.env.ADMIN_WALLETS ?? '')
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean)
  if (adminWallets.length === 0) return false

  const sb = getSupabaseAdmin()
  const { data: row, error } = await sb.from('profiles').select('wallet_address').eq('id', userId).maybeSingle()
  if (error || !row || typeof (row as { wallet_address?: string | null }).wallet_address !== 'string') {
    return false
  }
  const w = String((row as { wallet_address: string }).wallet_address).trim()
  const set = new Set(adminWallets.map((x) => x.toLowerCase()))
  return w.length > 0 && set.has(w.toLowerCase())
}

/** Server-side operator gate for `/operator/*` and legacy ops redirects. */
export async function requireOperatorPage(loginNext = '/operator'): Promise<OperatorIdentity> {
  // Debug: proves redirect is from this gate (not middleware) when cookies fail.
  if (await hasAdminBypass()) {
    return { userId: 'admin-bypass', email: FORCE_OPERATOR_EMAIL }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/landing?next=${encodeURIComponent(loginNext)}`)
  }
  const ok = await isOperatorUser(user.id, user.email)
  if (!ok) {
    redirect('/dashboard')
  }
  return { userId: user.id, email: user.email ?? null }
}

/** Session required (customer or operator) — blocks anonymous dashboard preview. */
export async function requireAuthenticatedPage(loginNext: string): Promise<OperatorIdentity> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/landing?next=${encodeURIComponent(loginNext)}`)
  }
  return { userId: user.id, email: user.email ?? null }
}
