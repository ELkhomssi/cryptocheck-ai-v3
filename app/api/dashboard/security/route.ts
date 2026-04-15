import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Recent security-relevant log lines + lightweight trust placeholder for the panel.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = getSupabaseAdmin()
  const { data: rows } = await sb
    .from('security_logs')
    .select('id, action, resource, ip, metadata, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40)

  const alerts =
    rows?.filter((r) =>
      ['api_key_denied', 'api_key_v2_revoked', 'scan_v1_error'].includes(r.action as string)
    ) ?? []

  return NextResponse.json({
    trust_score: 82,
    trust_note:
      'Trust scores are derived from device / IP heuristics at scan time. Wire `getRequestFingerprint` in hot paths for full detail.',
    recent_events: rows ?? [],
    alerts,
  })
}
