import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = body?.action === 'consume' ? 'consume' : 'check'

    // Verify the user's session via cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Use service role for the actual deduction (bypasses RLS)
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch current profile
    const { data: profile, error: fetchErr } = await svc
      .from('profiles')
      .select('credits, is_pro')
      .eq('id', user.id)
      .single()

    if (fetchErr || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Pro users have unlimited scans
    if (profile.is_pro) {
      return NextResponse.json({ credits: -1, unlimited: true, allowed: true })
    }

    // Check credits
    if (profile.credits <= 0) {
      return NextResponse.json({ error: 'No credits remaining', credits: 0 }, { status: 402 })
    }

    // Check-only mode blocks scans server-side without consuming credit.
    if (action === 'check') {
      return NextResponse.json({ credits: profile.credits, allowed: true, mode: 'check' })
    }

    // Consume mode is called only after a successful scan.
    const { data: consumed, error: rpcErr } = await svc.rpc('consume_credit', { p_user_id: user.id })
    if (rpcErr) {
      const fallbackCredits = profile.credits - 1
      const { data: updatedRows, error: updateErr } = await svc
        .from('profiles')
        .update({ credits: fallbackCredits, last_scan_at: new Date().toISOString() })
        .eq('id', user.id)
        .gt('credits', 0)
        .select('credits')

      if (updateErr) {
        return NextResponse.json({ error: 'Failed to deduct credit' }, { status: 500 })
      }

      if (!updatedRows?.length) {
        return NextResponse.json({ error: 'No credits remaining', credits: 0 }, { status: 402 })
      }

      return NextResponse.json({ credits: updatedRows[0].credits, used: 1, mode: 'consume' })
    }

    const nextCredits = Array.isArray(consumed) ? consumed[0]?.new_credits : null
    return NextResponse.json({ credits: nextCredits ?? Math.max(0, profile.credits - 1), used: 1, mode: 'consume' })

  } catch (e: any) {
    console.error('[USE-CREDIT] Error:', e)
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
