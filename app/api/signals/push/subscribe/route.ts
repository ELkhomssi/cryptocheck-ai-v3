import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  resolveSignalTier,
  savePushSubscription,
} from '@/lib/signal-aggregator/subscription'

export const dynamic = 'force-dynamic'

/** POST /api/signals/push/subscribe — premium PWA push registration. */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  const tier = await resolveSignalTier({ userId: user.id })
  if (tier !== 'premium') {
    return NextResponse.json({ error: 'Premium subscription required' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
  const p256dh = body.keys?.p256dh
  const auth = body.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 })
  }

  await savePushSubscription(user.id, { endpoint, keys: { p256dh, auth } })

  const sb = (await import('@/lib/supabase/admin')).getSupabaseAdmin()
  await sb
    .from('signal_subscription')
    .upsert({ user_id: user.id, push_enabled: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}
