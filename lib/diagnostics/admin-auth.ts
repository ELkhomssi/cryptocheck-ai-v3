import 'server-only'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type DiagnosticsAdminOk = { ok: true; userId: string; email: string | null; via: 'session' | 'secret' }
export type DiagnosticsAdminFail = { ok: false; response: NextResponse }

/**
 * Diagnostics API gate: session user email allowlist, or Bearer DIAGNOSTICS_ADMIN_SECRET.
 */
export async function assertDiagnosticsAdmin(authHeader: string | null): Promise<DiagnosticsAdminOk | DiagnosticsAdminFail> {
  const secret = process.env.DIAGNOSTICS_ADMIN_SECRET?.trim()
  if (secret && authHeader === `Bearer ${secret}`) {
    return { ok: true, userId: 'system', email: null, via: 'secret' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const email = (user.email ?? '').toLowerCase()
  const extra = (process.env.DIAGNOSTICS_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const domainOk = email.endsWith('@cryptocheckai.com')
  const listed = extra.length > 0 && extra.includes(email)

  let walletOk = false
  const adminWallets = (process.env.ADMIN_WALLETS ?? '')
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean)
  if (adminWallets.length > 0) {
    const sb = getSupabaseAdmin()
    const { data: row, error } = await sb.from('profiles').select('wallet_address').eq('id', user.id).maybeSingle()
    if (!error && row && typeof (row as { wallet_address?: string | null }).wallet_address === 'string') {
      const w = String((row as { wallet_address: string }).wallet_address).trim()
      const set = new Set(adminWallets.map((x) => x.toLowerCase()))
      walletOk = w.length > 0 && set.has(w.toLowerCase())
    }
  }

  if (!domainOk && !listed && !walletOk) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true, userId: user.id, email: user.email ?? null, via: 'session' }
}
