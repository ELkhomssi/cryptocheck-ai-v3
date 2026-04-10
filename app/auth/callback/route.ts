import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  // Always redirect to www to avoid cookie domain mismatch
  const BASE = 'https://www.cryptocheckai.com'

  if (error) {
    return NextResponse.redirect(BASE + '/app?auth=error')
  }

  if (!code) {
    return NextResponse.redirect(BASE + '/app')
  }

  // KEY FIX: Build redirect response FIRST, then wire cookies through it
  const redirectResponse = NextResponse.redirect(BASE + '/app')

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, {
              ...options,
              domain: '.cryptocheckai.com',
              path: '/',
              sameSite: 'lax',
              secure: true,
            })
          })
        },
      },
    }
  )

  try {
    const { data, error: exchError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchError) {
      console.error('exchangeCodeForSession error:', exchError.message)
      return NextResponse.redirect(BASE + '/app?auth=error')
    }

    // Profile upsert with service role (separate client)
    if (data?.user) {
      try {
        const svc = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        await svc.from('profiles').upsert(
          {
            id:               data.user.id,
            email:            data.user.email,
            confirmed_at:     new Date().toISOString(),
            trial_started_at: new Date().toISOString(),
            is_pro:           false,
            plan:             'free',
          },
          { onConflict: 'id', ignoreDuplicates: false }
        )
      } catch (profileErr) {
        console.error('Profile upsert error:', profileErr)
      }
    }

    // Return response that CARRIES the session cookies
    return redirectResponse

  } catch (e) {
    console.error('Auth callback unexpected error:', e)
    return NextResponse.redirect(BASE + '/app?auth=error')
  }
}
