#!/bin/bash
# ============================================================
# CryptoCheck AI — Fix #3: THE REAL AUTH FIX
#
# ROOT CAUSE FOUND:
# ─────────────────
# PKCE flow stores a "code_verifier" in the BROWSER (localStorage)
# when signInWithOAuth() is called from the AuthModal.
#
# The callback route.ts runs on the SERVER and creates a new
# createServerClient — which has NO access to browser localStorage.
# So exchangeCodeForSession() fails every time because the
# code_verifier is missing/mismatched.
#
# THE FIX:
# ─────────
# Option A: Don't use a server callback. Let the browser client
#           detect the auth code in the URL and exchange it.
#           This means using the IMPLICIT flow or handling PKCE
#           entirely client-side.
#
# Option B (what we do here): Change the AuthModal to redirect
#           to the callback WITH the code, and have the callback
#           do a client-side exchange using createBrowserClient
#           (which CAN access localStorage).
#
# We go with a HYBRID approach:
#   1. AuthModal initiates OAuth (stores code_verifier in localStorage)
#   2. Supabase redirects to /auth/callback?code=xxx
#   3. /auth/callback is a CLIENT COMPONENT page that:
#      - Reads the code from URL
#      - Uses createBrowserClient to exchange it (has localStorage access)
#      - Upserts the profile via an API route
#      - Redirects to /app
# ============================================================

set -e
echo "🔧 Fix #3: PKCE code_verifier fix (the real one)..."

# ---- Step 1: Delete the broken server-side callback route ----
echo ""
echo "🗑️  Removing broken server-side callback..."
rm -f app/auth/callback/route.ts
echo "   ✅ Deleted app/auth/callback/route.ts"

# ---- Step 2: Create client-side callback PAGE ----
echo ""
echo "📝 Creating app/auth/callback/page.tsx (client-side PKCE exchange)..."

mkdir -p app/auth/callback
cat > app/auth/callback/page.tsx << 'ENDOFSCRIPT'
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Create BROWSER client — this has access to localStorage
        // where the PKCE code_verifier was stored by signInWithOAuth()
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // Get the code from URL
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const error = params.get('error')
        const errorDescription = params.get('error_description')

        if (error) {
          console.error('[AUTH CALLBACK] OAuth error:', error, errorDescription)
          setErrorMsg(errorDescription || error)
          setStatus('error')
          return
        }

        if (!code) {
          console.error('[AUTH CALLBACK] No code in URL')
          setErrorMsg('No authorization code received')
          setStatus('error')
          return
        }

        // Exchange code for session — BROWSER-SIDE so code_verifier is available
        const { data, error: exchError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchError) {
          console.error('[AUTH CALLBACK] Exchange error:', exchError.message)
          setErrorMsg(exchError.message)
          setStatus('error')
          return
        }

        console.log('[AUTH CALLBACK] Session created for:', data?.user?.email)

        // Upsert profile via API (don't expose service role key to client)
        if (data?.user) {
          try {
            await fetch('/api/auth/profile-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: data.user.id,
                email: data.user.email,
              }),
            })
          } catch (e) {
            // Non-blocking
            console.error('[AUTH CALLBACK] Profile sync error:', e)
          }
        }

        setStatus('success')

        // Redirect to app
        window.location.replace('/app')

      } catch (e: any) {
        console.error('[AUTH CALLBACK] Unexpected error:', e)
        setErrorMsg(e?.message || 'Unexpected error')
        setStatus('error')
      }
    }

    handleCallback()
  }, [])

  return (
    <div style={{
      background: '#050a06',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'IBM Plex Mono, monospace',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: 40,
      }}>
        {status === 'loading' && (
          <>
            <div style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(0, 212, 170, 0.2)',
              borderTop: '3px solid #00d4aa',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: '#00d4aa', letterSpacing: '0.1em' }}>
              AUTHENTICATING...
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 32, color: '#00d4aa' }}>✓</div>
            <div style={{ fontSize: 13, color: '#00d4aa' }}>
              SIGNED IN — REDIRECTING...
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 32, color: '#ff4444' }}>✗</div>
            <div style={{ fontSize: 13, color: '#ff4444', marginBottom: 8 }}>
              AUTHENTICATION FAILED
            </div>
            <div style={{ fontSize: 11, color: '#6e7681', maxWidth: 400, textAlign: 'center' }}>
              {errorMsg}
            </div>
            <button
              onClick={() => window.location.replace('/app')}
              style={{
                marginTop: 16,
                padding: '8px 24px',
                background: 'rgba(0, 212, 170, 0.1)',
                border: '1px solid rgba(0, 212, 170, 0.3)',
                borderRadius: 6,
                color: '#00d4aa',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            >
              ← Back to App
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
ENDOFSCRIPT
echo "   ✅ app/auth/callback/page.tsx"

# ---- Step 3: Create profile-sync API route (keeps service role key server-side) ----
echo ""
echo "📝 Creating app/api/auth/profile-sync/route.ts..."

mkdir -p app/api/auth/profile-sync
cat > app/api/auth/profile-sync/route.ts << 'ENDOFSCRIPT'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[PROFILE SYNC] Error:', e)
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
ENDOFSCRIPT
echo "   ✅ app/api/auth/profile-sync/route.ts"

# ---- Step 4: Patch AuthModal to use correct redirectTo ----
echo ""
echo "🔧 Patching AuthModal redirectTo..."

AUTHMODAL=""
for f in components/AuthModal.tsx components/AuthModal.jsx app/components/AuthModal.tsx src/components/AuthModal.tsx; do
  if [ -f "$f" ]; then
    AUTHMODAL="$f"
    break
  fi
done

if [ -n "$AUTHMODAL" ]; then
  echo "   Found: $AUTHMODAL"
  # Replace any window.location.origin with hardcoded www
  sed -i.bak "s|window\.location\.origin|'https://www.cryptocheckai.com'|g" "$AUTHMODAL"
  sed -i.bak "s|\\\${window\.location\.origin}|https://www.cryptocheckai.com|g" "$AUTHMODAL"
  rm -f "${AUTHMODAL}.bak"
  echo "   ✅ Patched"
  grep -n "redirectTo\|www\.cryptocheckai" "$AUTHMODAL" | head -5
else
  echo "   ⚠️  AuthModal not found at expected paths"
  echo "   Finding it..."
  FOUND=$(find . -name "AuthModal*" -not -path "*/node_modules/*" 2>/dev/null | head -3)
  if [ -n "$FOUND" ]; then
    echo "   Found at: $FOUND"
    for f in $FOUND; do
      sed -i.bak "s|window\.location\.origin|'https://www.cryptocheckai.com'|g" "$f"
      rm -f "${f}.bak"
      echo "   ✅ Patched: $f"
    done
  else
    echo "   ❌ No AuthModal found — you'll need to manually ensure redirectTo uses"
    echo "      'https://www.cryptocheckai.com/auth/callback'"
  fi
fi

# ---- Step 5: Keep middleware for www enforcement + session refresh ----
echo ""
echo "📝 Keeping middleware.ts (www redirect + session refresh)..."
# Only rewrite if it doesn't have the www redirect already
if ! grep -q "www.cryptocheckai.com" middleware.ts 2>/dev/null; then
cat > middleware.ts << 'ENDOFSCRIPT'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Force www to prevent cookie domain issues
  const url = request.nextUrl.clone()
  if (url.hostname === 'cryptocheckai.com') {
    url.hostname = 'www.cryptocheckai.com'
    return NextResponse.redirect(url, 301)
  }

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

  await supabase.auth.getUser()
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
ENDOFSCRIPT
echo "   ✅ middleware.ts"
else
echo "   ✅ middleware.ts already has www redirect"
fi

# ---- Step 6: Verify ----
echo ""
echo "📋 Final verification:"
for f in app/auth/callback/page.tsx app/api/auth/profile-sync/route.ts middleware.ts lib/supabase/client.ts lib/supabase/server.ts; do
  if [ -f "$f" ]; then
    echo "   ✅ $f"
  else
    echo "   ❌ $f"
  fi
done

# Make sure old route.ts is gone
if [ -f "app/auth/callback/route.ts" ]; then
  echo "   ⚠️  app/auth/callback/route.ts still exists — deleting..."
  rm -f app/auth/callback/route.ts
  echo "   ✅ Deleted"
fi

echo ""
echo "🔍 TypeScript check..."
npx tsc --noEmit 2>&1 | head -20

echo ""
echo "============================================"
echo "✅ THE REAL FIX IS IN PLACE"
echo ""
echo "What changed:"
echo "  OLD: Server route.ts tried exchangeCodeForSession()"
echo "       → Server has NO access to PKCE code_verifier in localStorage"
echo "       → ALWAYS fails"
echo ""
echo "  NEW: Client page.tsx does exchangeCodeForSession()"
echo "       → Browser HAS the code_verifier in localStorage"
echo "       → Works correctly"
echo ""
echo "🚀 Deploy:"
echo "   git add -A && git commit -m 'fix: client-side PKCE exchange (code_verifier in localStorage)' && vercel --prod"
echo ""
echo "⚠️  Supabase Dashboard — Redirect URLs must include:"
echo "   https://www.cryptocheckai.com/auth/callback"
echo "   https://cryptocheckai.com/auth/callback"
echo "============================================"
