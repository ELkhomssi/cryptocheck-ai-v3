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
