#!/bin/bash
# ============================================================
# CryptoCheck AI — Fix: Cookie-based session with @supabase/ssr
# Run from: ~/crypto  (or ~/Desktop/cryptocheck-ai)
# ============================================================

set -e
echo "🔧 Starting auth session fix..."

# ---- Step 1: Install @supabase/ssr ----
echo "📦 Installing @supabase/ssr..."
npm install @supabase/ssr

# ---- Step 2: Create directories ----
mkdir -p lib/supabase
mkdir -p app/auth/callback
echo "✅ Directories ready"

# ---- Step 3: lib/supabase/client.ts (Browser client) ----
cat > lib/supabase/client.ts << 'ENDOFSCRIPT'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
ENDOFSCRIPT
echo "✅ lib/supabase/client.ts"

# ---- Step 4: lib/supabase/server.ts (Server client with cookies) ----
cat > lib/supabase/server.ts << 'ENDOFSCRIPT'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore
            // if you have middleware refreshing user sessions
          }
        },
      },
    }
  )
}
ENDOFSCRIPT
echo "✅ lib/supabase/server.ts"

# ---- Step 5: app/auth/callback/route.ts (THE critical fix) ----
cat > app/auth/callback/route.ts << 'ENDOFSCRIPT'
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
ENDOFSCRIPT
echo "✅ app/auth/callback/route.ts"

# ---- Step 6: middleware.ts (project root — session refresh) ----
cat > middleware.ts << 'ENDOFSCRIPT'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Triggers session refresh — use getUser() not getSession() for security
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
ENDOFSCRIPT
echo "✅ middleware.ts"

# ---- Step 7: Verify all files exist ----
echo ""
echo "📋 Verification:"
for f in lib/supabase/client.ts lib/supabase/server.ts app/auth/callback/route.ts middleware.ts; do
  if [ -f "$f" ]; then
    echo "   ✅ $f"
  else
    echo "   ❌ MISSING: $f"
  fi
done

# ---- Step 8: TypeScript check ----
echo ""
echo "🔍 Running TypeScript check..."
npx tsc --noEmit 2>&1 | head -20

echo ""
echo "============================================"
echo "🚀 Ready to deploy! Run:"
echo "   git add -A && git commit -m 'fix: cookie-based session with @supabase/ssr' && vercel --prod"
echo ""
echo "⚠️  Don't forget to check Supabase Dashboard:"
echo "   Authentication → URL Configuration → Redirect URLs"
echo "   Must include: https://www.cryptocheckai.com/auth/callback"
echo "============================================"
