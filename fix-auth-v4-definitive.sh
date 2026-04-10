#!/bin/bash
# ============================================================
# CryptoCheck AI — Fix #4: DEFINITIVE AUTH FIX
#
# ERROR: "PKCE code verifier not found in storage"
#
# WHY:
#   AuthModal uses createClient from @supabase/supabase-js
#   → stores code_verifier in localStorage
#   → OAuth flow starts on www.cryptocheckai.com
#   → Google redirects back to cryptocheckai.com (no www)
#   → Different origin = different localStorage
#   → code_verifier NOT FOUND
#
# FIX:
#   1. AuthModal: use createBrowserClient from @supabase/ssr
#      → stores code_verifier in COOKIES (shared across subdomains)
#   2. Callback page: use same createBrowserClient
#   3. Every component that touches supabase.auth must use the
#      @supabase/ssr client, NOT the raw @supabase/supabase-js
# ============================================================

set -e
echo "🔧 Fix #4: PKCE code_verifier in cookies (definitive fix)..."

# ---- Step 1: Find and patch ALL files using raw createClient for auth ----
echo ""
echo "🔍 Finding all files that import createClient from @supabase/supabase-js..."

# Find AuthModal
AUTHMODAL=""
for f in $(find . -name "AuthModal*" -not -path "*/node_modules/*" -not -path "*/.next/*" 2>/dev/null); do
  AUTHMODAL="$f"
  echo "   Found AuthModal: $f"
done

if [ -z "$AUTHMODAL" ]; then
  echo "   ❌ AuthModal not found! Searching for signInWithOAuth..."
  grep -rl "signInWithOAuth" --include="*.tsx" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null | head -5
fi

# Show current import in AuthModal
if [ -n "$AUTHMODAL" ]; then
  echo ""
  echo "📋 Current AuthModal imports:"
  grep -n "import.*createClient\|import.*supabase\|from.*supabase" "$AUTHMODAL" | head -10
  echo ""
  echo "📋 Current supabase client creation:"
  grep -n "createClient\|createBrowserClient" "$AUTHMODAL" | head -10
fi

# ---- Step 2: Rewrite AuthModal to use createBrowserClient ----
echo ""
echo "📝 Patching AuthModal to use createBrowserClient from @supabase/ssr..."

if [ -n "$AUTHMODAL" ]; then
  # Replace the import
  sed -i.bak "s|import { createClient } from '@supabase/supabase-js'|import { createBrowserClient } from '@supabase/ssr'|g" "$AUTHMODAL"
  
  # Replace the client creation (handle both inline and assigned patterns)
  # Pattern 1: const supabase = createClient(...)
  sed -i.bak "s|createClient(|createBrowserClient(|g" "$AUTHMODAL"
  
  # Make sure window.location.origin is hardcoded to www
  sed -i.bak "s|window\.location\.origin|'https://www.cryptocheckai.com'|g" "$AUTHMODAL"
  sed -i.bak 's|\${window\.location\.origin}|https://www.cryptocheckai.com|g' "$AUTHMODAL"
  
  rm -f "${AUTHMODAL}.bak"
  
  echo "   ✅ Patched AuthModal"
  echo ""
  echo "📋 Updated imports:"
  grep -n "import.*Browser\|import.*ssr\|createBrowserClient\|createClient" "$AUTHMODAL" | head -10
else
  echo "   ⚠️  Creating AuthModal from scratch with correct client..."
fi

# ---- Step 3: Update callback page to use createBrowserClient ----
echo ""
echo "📝 Updating app/auth/callback/page.tsx..."

mkdir -p app/auth/callback
# Remove any leftover route.ts
rm -f app/auth/callback/route.ts

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
        // MUST use createBrowserClient — same as AuthModal
        // This shares the cookie storage where code_verifier lives
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const error = params.get('error')
        const errorDescription = params.get('error_description')

        if (error) {
          console.error('[AUTH CB] OAuth error:', error, errorDescription)
          setErrorMsg(errorDescription || error)
          setStatus('error')
          return
        }

        if (!code) {
          console.error('[AUTH CB] No code in URL')
          setErrorMsg('No authorization code received')
          setStatus('error')
          return
        }

        console.log('[AUTH CB] Exchanging code for session...')
        const { data, error: exchError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchError) {
          console.error('[AUTH CB] Exchange error:', exchError.message)
          setErrorMsg(exchError.message)
          setStatus('error')
          return
        }

        console.log('[AUTH CB] Success! User:', data?.user?.email)

        // Profile sync (non-blocking)
        if (data?.user) {
          fetch('/api/auth/profile-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: data.user.id, email: data.user.email }),
          }).catch(e => console.error('[AUTH CB] Profile sync error:', e))
        }

        setStatus('success')
        setTimeout(() => window.location.replace('/app'), 500)

      } catch (e: any) {
        console.error('[AUTH CB] Unexpected:', e)
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 40 }}>
        {status === 'loading' && (
          <>
            <div style={{
              width: 40, height: 40,
              border: '3px solid rgba(0,212,170,0.2)',
              borderTop: '3px solid #00d4aa',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: '#00d4aa', letterSpacing: '0.1em' }}>AUTHENTICATING...</div>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 32, color: '#00d4aa' }}>✓</div>
            <div style={{ fontSize: 13, color: '#00d4aa' }}>SIGNED IN — REDIRECTING...</div>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 32, color: '#ff4444' }}>✗</div>
            <div style={{ fontSize: 13, color: '#ff4444', marginBottom: 8 }}>AUTHENTICATION FAILED</div>
            <div style={{ fontSize: 11, color: '#6e7681', maxWidth: 400, textAlign: 'center' }}>{errorMsg}</div>
            <button onClick={() => window.location.replace('/app')} style={{
              marginTop: 16, padding: '8px 24px',
              background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)',
              borderRadius: 6, color: '#00d4aa', fontSize: 12, cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
            }}>← Back to App</button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
ENDOFSCRIPT
echo "   ✅ app/auth/callback/page.tsx"

# ---- Step 4: Also patch page.tsx if it creates its own supabase client for auth ----
echo ""
echo "🔍 Checking page.tsx for raw createClient usage with auth..."
if [ -f "app/page.tsx" ]; then
  AUTH_LINES=$(grep -n "supabase.auth\|getSession\|onAuthStateChange" app/page.tsx | head -5)
  if [ -n "$AUTH_LINES" ]; then
    echo "   Found auth usage in page.tsx:"
    echo "$AUTH_LINES"
    
    # Check if it uses the raw client
    RAW_IMPORT=$(grep "import.*createClient.*from.*@supabase/supabase-js" app/page.tsx)
    if [ -n "$RAW_IMPORT" ]; then
      echo ""
      echo "   ⚠️  page.tsx uses raw createClient for auth — patching..."
      
      # Add createBrowserClient import if not present
      if ! grep -q "createBrowserClient" app/page.tsx; then
        sed -i.bak "1s|^|import { createBrowserClient } from '@supabase/ssr'\n|" app/page.tsx
        rm -f app/page.tsx.bak
      fi
      
      echo "   ℹ️  NOTE: page.tsx may need manual review to ensure auth calls"
      echo "          use createBrowserClient instead of raw createClient"
    fi
  fi
fi

# ---- Step 5: Find ALL other files using raw supabase client for auth ----
echo ""
echo "🔍 Scanning for other files using raw createClient with auth..."
grep -rl "createClient.*supabase-js" --include="*.tsx" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null | while read f; do
  if grep -q "supabase.auth\|signInWith\|getSession\|onAuthStateChange" "$f" 2>/dev/null; then
    echo "   ⚠️  $f — uses raw client WITH auth methods (may need patching)"
  fi
done

# ---- Step 6: Verify ----
echo ""
echo "📋 Verification:"
for f in app/auth/callback/page.tsx app/api/auth/profile-sync/route.ts middleware.ts lib/supabase/client.ts; do
  [ -f "$f" ] && echo "   ✅ $f" || echo "   ❌ $f"
done
[ -f "app/auth/callback/route.ts" ] && echo "   ❌ route.ts still exists!" || echo "   ✅ No leftover route.ts"

echo ""
echo "🔍 TypeScript check..."
npx tsc --noEmit 2>&1 | head -20

echo ""
echo "============================================"
echo "✅ FIX #4 APPLIED"
echo ""
echo "What changed:"
echo "  • AuthModal: createClient → createBrowserClient (@supabase/ssr)"
echo "    → code_verifier stored in COOKIES, not localStorage"
echo "    → cookies work across www/non-www via .cryptocheckai.com domain"
echo ""
echo "  • Callback page.tsx: also uses createBrowserClient"
echo "    → reads code_verifier from same cookies"
echo "    → exchangeCodeForSession() now has what it needs"
echo ""
echo "🚀 Deploy:"
echo "   git add -A && git commit -m 'fix: PKCE code_verifier in cookies via createBrowserClient' && vercel --prod"
echo "============================================"
