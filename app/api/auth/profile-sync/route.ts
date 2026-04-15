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

    const { error } = await svc.from('profiles').upsert(
      {
        id,
        email,
        confirmed_at:     new Date().toISOString(),
        trial_started_at: new Date().toISOString(),
        is_pro:           false,
        plan:             'free',
      },
      { onConflict: 'id', ignoreDuplicates: false }
    )

    if (error) {
      console.error('[PROFILE SYNC] Upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    try {
      await ensureFreeTierSubscription(id)
    } catch (e) {
      console.error('[PROFILE SYNC] saas_subscriptions FREE tier:', e)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[PROFILE SYNC] Error:', e)
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
