import { supabase } from '@/lib/supabase'
'use client'
import { useEffect, useState } from 'react'
import LandingPage from './landing/page'


export default function RootPage() {
  const [status, setStatus] = useState<'loading'|'guest'|'user'>('loading')

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        window.location.replace('/app')
      } else {
        setStatus('guest')
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        window.location.replace('/app')
      } else {
        setStatus('guest')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (status === 'loading') {
    return (
      <div style={{
        background: '#000',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontFamily: "'JetBrains Mono',monospace"
      }}>
        {/* Teal spinner */}
        <div style={{
          width: 28,
          height: 28,
          border: '2px solid rgba(32,178,170,0.15)',
          borderTop: '2px solid #20b2aa',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite'
        }}/>
        <div style={{fontSize: 10, color: 'rgba(32,178,170,0.5)', letterSpacing: '0.1em', fontWeight: 400}}>
          LOADING
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return <LandingPage />
}
