/**
 * POST /api/terminal/settings/danger
 * Body: { action: 'clear_watchlist' | 'clear_alerts', confirm: true, walletAddress? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClientOptional } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: { action?: string; confirm?: boolean; walletAddress?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (body.confirm !== true) {
    return NextResponse.json({ error: 'confirm:true required' }, { status: 400 })
  }

  const action = body.action
  if (action !== 'clear_watchlist' && action !== 'clear_alerts') {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  }

  if (action === 'clear_watchlist') {
    const sb = await createClientOptional()
    if (!sb) {
      return NextResponse.json({ error: 'Auth unavailable' }, { status: 503 })
    }
    const {
      data: { user },
    } = await sb.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Sign in required to clear watchlist' }, { status: 401 })
    }
    try {
      const admin = getSupabaseAdmin()
      const { error, count } = await admin
        .from('watchlist')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, action, deleted: count ?? null })
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'clear failed' },
        { status: 503 },
      )
    }
  }

  // clear_alerts — wipe portfolio_alerts rows + in-process cache
  try {
    const { clearAlertsMemory } = await import('@/lib/portfolio-desk/alerts-store')
    await clearAlertsMemory()
  } catch {
    /* optional */
  }
  try {
    const admin = getSupabaseAdmin()
    let q = admin.from('portfolio_alerts').delete({ count: 'exact' }).neq('id', '')
    if (body.walletAddress && body.walletAddress.length >= 32) {
      // Prefer wallet-scoped clear when column present; ignore filter errors.
      q = admin
        .from('portfolio_alerts')
        .delete({ count: 'exact' })
        .or(`wallet_address.eq.${body.walletAddress},wallet_address.is.null`)
    }
    const { error, count } = await q
    if (error) {
      // Fallback: delete all (table may lack wallet_address)
      const { error: e2, count: c2 } = await admin
        .from('portfolio_alerts')
        .delete({ count: 'exact' })
        .neq('id', '')
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      return NextResponse.json({ ok: true, action, deleted: c2 ?? null })
    }
    return NextResponse.json({ ok: true, action, deleted: count ?? null })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'clear failed' },
      { status: 503 },
    )
  }
}
