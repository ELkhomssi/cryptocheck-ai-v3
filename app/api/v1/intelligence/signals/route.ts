import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('intelligence_signals')
      .select('id,mint,signal_type,verdict,confidence_pct,whale_count,net_flow_usd,ai_reasoning,generated_at')
      .order('generated_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return NextResponse.json({ items: data ?? [] })
  } catch (err) {
    console.error('[signals/list]', err)
    return NextResponse.json({ items: [] })
  }
}
