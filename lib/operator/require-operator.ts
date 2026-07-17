import 'server-only'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type OperatorIdentity = {
  userId: string
  email: string | null
}

/**
 * Operator allowlist: DIAGNOSTICS_ADMIN_EMAILS only (comma-separated, trimmed, lowercased).
 */
export async function isOperatorUser(_userId: string, email: string | null | undefined): Promise<boolean> {
  const normalized = (email ?? '').toLowerCase().trim()
  if (!normalized) return false

  const allow = (process.env.DIAGNOSTICS_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  return allow.includes(normalized)
}

/** Server-side operator gate for `/operator/*` and legacy ops redirects. */
export async function requireOperatorPage(loginNext = '/operator'): Promise<OperatorIdentity> {
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
