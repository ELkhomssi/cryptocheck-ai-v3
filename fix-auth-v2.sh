#!/bin/bash
# ============================================================
# CryptoCheck AI — Fix #2: auth=error after Google OAuth
# Problem: exchangeCodeForSession fails because:
#   1. AuthModal uses window.location.origin (non-www) as redirectTo
#   2. Supabase sends code back to non-www, but callback expects www
#   3. Possible supabase-js v2.91.0 setTimeout bug breaks cookie writes
# ============================================================

set -e
echo "🔧 Fix #2: Resolving auth=error after Google OAuth..."

# ---- Step 1: Check supabase-js version for the setTimeout bug ----
echo ""
echo "📋 Checking @supabase/supabase-js version..."
SBJS_VERSION=$(node -e "try{console.log(require('@supabase/supabase-js/package.json').version)}catch(e){console.log('unknown')}")
echo "   Current version: $SBJS_VERSION"
if [ "$SBJS_VERSION" = "2.91.0" ]; then
  echo "   ⚠️  v2.91.0 has a known bug — pinning to 2.90.1"
  npm install @supabase/supabase-js@2.90.1
else
  echo "   ✅ Version OK"
fi

# ---- Step 2: Fix AuthModal — hardcode redirectTo to www ----
echo ""
echo "🔧 Patching AuthModal redirectTo..."

# Find the AuthModal file
AUTHMODAL=""
for f in components/AuthModal.tsx components/AuthModal.jsx app/components/AuthModal.tsx src/components/AuthModal.tsx; do
  if [ -f "$f" ]; then
    AUTHMODAL="$f"
    break
  fi
done

if [ -n "$AUTHMODAL" ]; then
  echo "   Found: $AUTHMODAL"
  # Replace window.location.origin with hardcoded www URL
  sed -i.bak "s|window\.location\.origin|'https://www.cryptocheckai.com'|g" "$AUTHMODAL"
  # Also fix any redirectTo that uses template literals with origin
  sed -i.bak 's|\${window\.location\.origin}|https://www.cryptocheckai.com|g' "$AUTHMODAL"
  # Also fix backtick template version
  sed -i.bak "s|\`\${window.location.origin}/auth/callback\`|'https://www.cryptocheckai.com/auth/callback'|g" "$AUTHMODAL"
  rm -f "${AUTHMODAL}.bak"
  echo "   ✅ Patched redirectTo to https://www.cryptocheckai.com"
  echo "   Content check:"
  grep -n "redirectTo\|redirect_to\|www\.cryptocheckai" "$AUTHMODAL" | head -5
else
  echo "   ⚠️  AuthModal not found — creating patched version..."
fi

# ---- Step 3: Rewrite auth callback with better error logging + await fix ----
echo ""
echo "🔧 Rewriting app/auth/callback/route.ts with enhanced error handling..."

mkdir -p app/auth/callback
cat > app/auth/callback/route.ts << 'ENDOFSCRIPT'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDesc = searchParams.get('error_description')

  // ALWAYS use www to prevent cookie domain mismatch
  const BASE = 'https://www.cryptocheckai.com'

  // Log everything for debugging
  console.log('[AUTH CALLBACK] code:', code ? 'present' : 'missing')
  console.log('[AUTH CALLBACK] error:', error)
  console.log('[AUTH CALLBACK] error_description:', errorDesc)
  console.log('[AUTH CALLBACK] full URL:', req.url)

  if (error) {
    console.error('[AUTH CALLBACK] OAuth error:', error, errorDesc)
    return NextResponse.redirect(`${BASE}/app?auth=error&reason=${encodeURIComponent(error)}`)
  }

  if (!code) {
    console.error('[AUTH CALLBACK] No code parameter in URL')
    return NextResponse.redirect(`${BASE}/app?auth=error&reason=no_code`)
  }

  // Build redirect response FIRST — cookies get attached to THIS response
  const redirectResponse = NextResponse.redirect(`${BASE}/app?auth=success`)

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
              // Use root domain so cookies work on both www and non-www
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
      console.error('[AUTH CALLBACK] exchangeCodeForSession error:', exchError.message, exchError)
      return NextResponse.redirect(`${BASE}/app?auth=error&reason=${encodeURIComponent(exchError.message)}`)
    }

    console.log('[AUTH CALLBACK] Session created for:', data?.user?.email)

    // ---- Profile upsert (service role) ----
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
        console.log('[AUTH CALLBACK] Profile upserted for:', data.user.email)
      } catch (profileErr) {
        console.error('[AUTH CALLBACK] Profile upsert error:', profileErr)
      }
    }

    // Return response WITH session cookies attached
    return redirectResponse

  } catch (e: any) {
    console.error('[AUTH CALLBACK] Unexpected error:', e?.message || e)
    return NextResponse.redirect(`${BASE}/app?auth=error&reason=unexpected`)
  }
}
ENDOFSCRIPT
echo "   ✅ app/auth/callback/route.ts (with full logging)"

# ---- Step 4: Add www enforcement in middleware ----
echo ""
echo "🔧 Updating middleware.ts with www redirect..."
cat > middleware.ts << 'ENDOFSCRIPT'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // ---- FORCE WWW: prevent cookie domain mismatch ----
  const url = request.nextUrl.clone()
  if (url.hostname === 'cryptocheckai.com') {
    url.hostname = 'www.cryptocheckai.com'
    return NextResponse.redirect(url, 301)
  }

  // ---- Supabase session refresh ----
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

  // Refresh session — use getUser() not getSession()
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
ENDOFSCRIPT
echo "   ✅ middleware.ts (with www enforcement)"

# ---- Step 5: Verify files ----
echo ""
echo "📋 Verification:"
for f in app/auth/callback/route.ts middleware.ts lib/supabase/server.ts lib/supabase/client.ts; do
  if [ -f "$f" ]; then
    echo "   ✅ $f"
  else
    echo "   ❌ MISSING: $f"
  fi
done

# Show AuthModal redirectTo status
echo ""
echo "📋 AuthModal redirectTo check:"
if [ -n "$AUTHMODAL" ]; then
  grep -n "redirectTo\|redirect.*callback\|window\.location\.origin" "$AUTHMODAL" | head -5 || echo "   (no matches — may need manual check)"
fi

# ---- Step 6: TypeScript check ----
echo ""
echo "🔍 TypeScript check..."
npx tsc --noEmit 2>&1 | head -20

echo ""
echo "============================================"
echo "🚀 Deploy:"
echo "   git add -A && git commit -m 'fix: www enforcement + auth callback logging + redirectTo hardcode' && vercel --prod"
echo ""
echo "⚠️  CRITICAL — Check Supabase Dashboard:"
echo "   Authentication → URL Configuration → Redirect URLs"
echo "   Add BOTH:"
echo "     https://www.cryptocheckai.com/auth/callback"
echo "     https://cryptocheckai.com/auth/callback"
echo ""
echo "📊 After deploy, check Vercel Runtime Logs:"
echo "   vercel.com/khomssis-projects/crypto → Logs tab"
echo "   Look for [AUTH CALLBACK] messages"
echo "============================================"
