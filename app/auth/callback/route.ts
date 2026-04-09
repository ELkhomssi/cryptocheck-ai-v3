import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')

  const BASE = 'https://www.cryptocheckai.com'

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await serviceSupabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        confirmed_at: new Date().toISOString(),
        trial_started_at: new Date().toISOString(),
        referral_source: 'direct',
        is_pro: false,
        plan: 'free'
      }, { onConflict: 'id' })

      // Redirect to /app with session token in hash (Supabase PKCE)
      const redirectUrl = new URL('/app', BASE)
      return NextResponse.redirect(redirectUrl.toString())
    }
  }

  return NextResponse.redirect(`https://www.cryptocheckai.com/?auth=error`)
}
