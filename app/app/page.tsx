'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ErrorBoundary from '@/components/ErrorBoundary'
import Dashboard from '../dashboard'
import { SubscriptionProvider } from '@/lib/subscription/SubscriptionContext'
import { DisclaimerBanner } from '@/components/legal/DisclaimerBanner'
import { TerminalProvider } from '@/components/Dashboard/intelligence-terminal/TerminalProvider'

export default function AppPage() {
  const [status, setStatus] = useState<'loading'|'ready'>('loading')

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        syncProfile(data.session.user)
      }
      setStatus('ready')
    })

    // Listen for auth changes (picks up PKCE code exchange from URL)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('[APP] User signed in:', session.user.email)
        syncProfile(session.user)
        // Clean up URL params after successful auth
        if (window.location.search.includes('code=')) {
          window.history.replaceState({}, '', '/app')
        }
      }
      setStatus('ready')
    })

    return () => subscription.unsubscribe()
  }, [])

  async function syncProfile(user: any) {
    try {
      await fetch('/api/auth/profile-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, email: user.email }),
      })
    } catch (e) {
      console.error('[APP] Profile sync error:', e)
    }
  }

  if (status === 'loading') return (
    <div style={{background:'#000',height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,fontFamily:"'JetBrains Mono',monospace"}}>
      <div style={{width:26,height:26,border:'2px solid rgba(52,211,153,0.15)',borderTop:'2px solid #34d399',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
      <div style={{fontSize:10,color:'rgba(52,211,153,0.5)',letterSpacing:'0.1em'}}>LOADING</div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  return (
    <ErrorBoundary name="Dashboard">
      <SubscriptionProvider>
        <TerminalProvider>
          <DisclaimerBanner variant="default" />
          <Dashboard />
        </TerminalProvider>
      </SubscriptionProvider>
    </ErrorBoundary>
  )
}
