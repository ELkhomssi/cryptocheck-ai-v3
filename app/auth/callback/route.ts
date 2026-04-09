import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect('https://www.cryptocheckai.com/?auth=error')
  }

  if (code) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error: exchError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchError) throw exchError
      if (data.user) {
        const svc = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        await svc.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          confirmed_at: new Date().toISOString(),
          trial_started_at: new Date().toISOString(),
          is_pro: false,
          plan: 'free'
        }, { onConflict: 'id', ignoreDuplicates: false })
        return NextResponse.redirect('https://www.cryptocheckai.com/app')
      }
    } catch(e) {
      console.error('Auth callback error:', e)
    }
  }
  return NextResponse.redirect('https://www.cryptocheckai.com/app')
}
