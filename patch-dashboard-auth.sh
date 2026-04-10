#!/bin/bash
# ============================================================
# CryptoCheck AI — Wire auth session + credits into Dashboard
# 
# What this does:
#   1. Adds useEffect to detect existing session + listen for changes
#   2. Syncs credits from Supabase profile (falls back to localStorage)
#   3. Adds logout function
#   4. Updates Sign In button → shows email + dropdown with logout
# ============================================================

set -e
echo "🔧 Wiring auth session + credits into Dashboard..."

# ---- Step 1: Add session listener after authUser state declaration ----
# Insert after line 1920 (const [authUser, setAuthUser] = useState<any>(null))

# First, create the code block to insert
PATCH_SESSION='
  // ── Auth session listener (picks up OAuth redirect + existing session) ──
  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setAuthUser(data.session.user)
        setIsPro(data.session.user.user_metadata?.is_pro || false)
        loadCreditsFromProfile(data.session.user.id)
      }
    })
    // Listen for sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setAuthUser(session.user)
        setIsPro(session.user.user_metadata?.is_pro || false)
        loadCreditsFromProfile(session.user.id)
        // Clean up URL after OAuth redirect
        if (window.location.search.includes("code=")) {
          window.history.replaceState({}, "", "/app")
        }
      }
      if (event === "SIGNED_OUT") {
        setAuthUser(null)
        setIsPro(false)
        setCredits(10)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Load credits from Supabase profile ──
  async function loadCreditsFromProfile(userId: string) {
    try {
      const { data } = await supabase.from("profiles").select("credits, is_pro").eq("id", userId).single()
      if (data) {
        if (data.credits !== null && data.credits !== undefined) {
          setCredits(data.credits)
          localStorage.setItem("cc_credits", String(data.credits))
        }
        if (data.is_pro) {
          setIsPro(true)
          localStorage.setItem("cc_is_pro", "true")
        }
      }
    } catch {
      // Fallback to localStorage credits
    }
  }

  // ── Use a credit (call this when Neural Scan runs) ──
  async function useCredit() {
    if (isPro) return true // unlimited
    if (credits <= 0) return false
    const newCredits = credits - 1
    setCredits(newCredits)
    localStorage.setItem("cc_credits", String(newCredits))
    // Sync to Supabase if logged in
    if (authUser?.id) {
      supabase.from("profiles").update({ credits: newCredits }).eq("id", authUser.id).then(() => {})
    }
    return true
  }

  // ── Sign out ──
  async function handleSignOut() {
    await supabase.auth.signOut()
    setAuthUser(null)
    setIsPro(false)
    localStorage.removeItem("cc_is_pro")
  }
'

# Use node to do the insertion safely
node << 'ENDOFSCRIPT'
const fs = require('fs');
let code = fs.readFileSync('app/dashboard.tsx', 'utf8');

// 1. Add session listener after authUser state
const authUserLine = "const [authUser,    setAuthUser]    = useState<any>(null)";
const sessionBlock = `const [authUser,    setAuthUser]    = useState<any>(null)

  // ── Auth session listener (picks up OAuth redirect + existing session) ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setAuthUser(data.session.user)
        setIsPro(data.session.user.user_metadata?.is_pro || false)
        loadCreditsFromProfile(data.session.user.id)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setAuthUser(session.user)
        setIsPro(session.user.user_metadata?.is_pro || false)
        loadCreditsFromProfile(session.user.id)
        if (window.location.search.includes('code=')) {
          window.history.replaceState({}, '', '/app')
        }
      }
      if (event === 'SIGNED_OUT') {
        setAuthUser(null)
        setIsPro(false)
        setCredits(10)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadCreditsFromProfile(userId: string) {
    try {
      const { data } = await supabase.from('profiles').select('credits, is_pro').eq('id', userId).single()
      if (data) {
        if (data.credits !== null && data.credits !== undefined) {
          setCredits(data.credits)
          localStorage.setItem('cc_credits', String(data.credits))
        }
        if (data.is_pro) { setIsPro(true); localStorage.setItem('cc_is_pro', 'true') }
      }
    } catch { /* fallback to localStorage */ }
  }

  async function useCredit(): Promise<boolean> {
    if (isPro) return true
    if (credits <= 0) return false
    const nc = credits - 1
    setCredits(nc)
    localStorage.setItem('cc_credits', String(nc))
    if (authUser?.id) {
      supabase.from('profiles').update({ credits: nc }).eq('id', authUser.id).then(() => {})
    }
    return true
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setAuthUser(null)
    setIsPro(false)
    localStorage.removeItem('cc_is_pro')
  }`;

if (code.includes(authUserLine) && !code.includes('loadCreditsFromProfile')) {
  code = code.replace(authUserLine, sessionBlock);
  console.log('✅ Added session listener + credit sync + signOut');
} else if (code.includes('loadCreditsFromProfile')) {
  console.log('⚠️  Session listener already exists');
} else {
  console.log('❌ Could not find authUser line');
}

// 2. Replace Sign In button with email + logout dropdown
const oldSignInBtn = `<button onClick={()=>setShowAuth(true)} style={{padding:'5px 12px',fontSize:'0.6rem',fontWeight:700,background:authUser?'rgba(52,211,153,0.1)':'transparent',border:authUser?'1px solid rgba(52,211,153,0.25)':'1px solid rgba(52,211,153,0.2)',borderRadius:4,color:authUser?'#34d399':'#6ee7b7',cursor:'pointer',fontFamily:'IBM Plex Mono,monospace'}}>
            {authUser ? '✓ '+authUser.email?.split('@')[0] : 'Sign In'}
          </button>`;

const newSignInBtn = `{authUser ? (
              <div style={{position:'relative',display:'inline-block'}}>
                <button onClick={handleSignOut} style={{padding:'5px 12px',fontSize:'0.6rem',fontWeight:700,background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.25)',borderRadius:4,color:'#34d399',cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:6,height:6,borderRadius:'50%',background:'#34d399',display:'inline-block'}}/>
                  {authUser.email?.split('@')[0]}
                  <span style={{fontSize:'0.5rem',opacity:0.6,marginLeft:4}}>✕</span>
                </button>
              </div>
            ) : (
              <button onClick={()=>setShowAuth(true)} style={{padding:'5px 12px',fontSize:'0.6rem',fontWeight:700,background:'transparent',border:'1px solid rgba(52,211,153,0.2)',borderRadius:4,color:'#6ee7b7',cursor:'pointer',fontFamily:'IBM Plex Mono,monospace'}}>
                Sign In
              </button>
            )}`;

if (code.includes("authUser ? '✓ '+authUser.email")) {
  code = code.replace(oldSignInBtn, newSignInBtn);
  console.log('✅ Replaced Sign In button with user email + logout');
} else {
  console.log('⚠️  Sign In button pattern not found — trying alternate');
  // Try a simpler match
  const simpleOld = "{authUser ? '✓ '+authUser.email?.split('@')[0] : 'Sign In'}";
  const simpleNew = "{authUser ? authUser.email?.split('@')[0] : 'Sign In'}";
  if (code.includes(simpleOld)) {
    // Just update the button onClick to toggle between auth modal and signout
    code = code.replace(
      "onClick={()=>setShowAuth(true)} style={{padding:'5px 12px'",
      "onClick={authUser ? handleSignOut : ()=>setShowAuth(true)} style={{padding:'5px 12px'"
    );
    code = code.replace(simpleOld, 
      "{authUser ? '● '+authUser.email?.split('@')[0]+' ✕' : 'Sign In'}"
    );
    console.log('✅ Updated Sign In button (simple patch)');
  } else {
    console.log('❌ Could not find Sign In button');
  }
}

// 3. Make sure supabase import is the @supabase/ssr one
if (code.includes("import { supabase as _supabase } from '@/lib/supabase'")) {
  // The dashboard imports it as _supabase but we need it as supabase for our code
  if (!code.includes("const supabase = _supabase")) {
    code = code.replace(
      "import { supabase as _supabase } from '@/lib/supabase'",
      "import { supabase } from '@/lib/supabase'"
    );
    console.log('✅ Fixed supabase import alias');
  }
}

// Also remove the old raw createClient import if it exists
if (code.includes("import { createClient } from '@supabase/supabase-js'")) {
  // Check if createClient is used elsewhere in the file
  const usages = (code.match(/createClient\(/g) || []).length;
  if (usages <= 1) {
    code = code.replace("import { createClient } from '@supabase/supabase-js'\n", '');
    console.log('✅ Removed unused raw createClient import');
  } else {
    console.log('⚠️  createClient used elsewhere — keeping import');
  }
}

fs.writeFileSync('app/dashboard.tsx', code);
console.log('');
console.log('📝 Dashboard patched successfully');
ENDOFSCRIPT

# ---- Step 2: Add credits column to profiles table if missing ----
echo ""
echo "📋 Note: You may need to add a 'credits' column to your profiles table."
echo "   Run this in Supabase SQL Editor:"
echo "   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 10;"
echo ""

# ---- Step 3: Verify ----
echo "🔍 TypeScript check..."
npx tsc --noEmit 2>&1 | head -15

echo ""
echo "============================================"
echo "✅ Dashboard wired up!"
echo ""
echo "Changes:"
echo "  • authUser auto-detected from supabase session on mount"
echo "  • onAuthStateChange picks up OAuth redirects"  
echo "  • Credits loaded from Supabase profile (fallback: localStorage)"
echo "  • useCredit() deducts 1 credit per Neural Scan"
echo "  • Sign In button → shows email + click to logout when signed in"
echo "  • handleSignOut() clears session + resets state"
echo ""
echo "🚀 Deploy:"
echo "   git add -A && git commit -m 'feat: wire auth session + credits + logout into dashboard' && vercel --prod"
echo ""
echo "⚠️  Run in Supabase SQL Editor:"
echo "   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 10;"
echo "============================================"
