import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ensureFreeTierSubscription } from '@/lib/services/saas-entitlement.service'

export async function POST(req: NextRequest) {
  try {
    const { id, email } = await req.json()

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing id or email' }, { status: 400 })
    }

    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date().toISOString()
    const emailNorm = String(email).toLowerCase().trim()

    const { data: existing, error: selErr } = await svc.from('profiles').select('id').eq('id', id).maybeSingle()

    if (selErr) {
      console.error('[PROFILE SYNC] Select error:', selErr)
      return NextResponse.json({ error: selErr.message }, { status: 500 })
    }

    if (!existing) {
      const { error: insErr } = await svc.from('profiles').insert({
        id,
        email: emailNorm,
        confirmed_at: now,
        trial_started_at: now,
        is_pro: false,
        plan: 'free',
      })
      if (insErr) {
        console.error('[PROFILE SYNC] Insert error:', insErr)
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    } else {
      const { error: upErr } = await svc
        .from('profiles')
        .update({
          email: emailNorm,
          confirmed_at: now,
        })
        .eq('id', id)
      if (upErr) {
        console.error('[PROFILE SYNC] Update error:', upErr)
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }
    }

    try {
      await ensureFreeTierSubscription(id)
    } catch (e) {
      console.error('[PROFILE SYNC] saas_subscriptions FREE tier:', e)
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[PROFILE SYNC] Error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
