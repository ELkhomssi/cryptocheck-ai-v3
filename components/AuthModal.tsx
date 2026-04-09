'use client'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'


interface AuthModalProps {
  onClose: () => void
  onSuccess: (user: any) => void
}

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode]       = useState<'signin'|'signup'>('signin')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<string|null>(null)
  const [error, setError]     = useState('')
  const [sent, setSent]       = useState(false)

  async function handleOAuth(provider: 'google'|'github') {
    setLoading(provider)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: 'https://www.cryptocheckai.com/auth/callback',
        queryParams: provider === 'google' ? { access_type: 'offline', prompt: 'consent' } : {}
      }
    })
    if (error) { setError(error.message); setLoading(null) }
  }

  async function handleEmail() {
    if (!email || !password) { setError('Email and password required'); return }
    setLoading('email')
    setError('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: 'https://www.cryptocheckai.com/auth/callback' }
        })
        if (error) throw error
        setSent(true)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onSuccess(data.user)
        onClose()
        window.location.replace('/app')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(16px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,fontFamily:'Inter,sans-serif'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'min(420px,95vw)',background:'#0a110b',border:'1px solid rgba(52,211,153,0.2)',borderRadius:14,overflow:'hidden',boxShadow:'0 0 60px rgba(52,211,153,0.1),0 32px 80px rgba(0,0,0,0.8)'}}>
        
        {/* Top bar */}
        <div style={{height:2,background:'linear-gradient(90deg,transparent,#34d399,transparent)'}}/>

        {/* Header */}
        <div style={{padding:'22px 24px 16px',borderBottom:'1px solid rgba(52,211,153,0.08)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <img src="/logo.jpg" alt="CryptoCheck AI" style={{width:26,height:26,borderRadius:6,objectFit:'cover'}}/>
              <span style={{fontSize:15,fontWeight:700,color:'#f0fdf4'}}>CryptoCheck<span style={{color:'#34d399'}}>AI</span></span>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',color:'#6ee7b7',cursor:'pointer',fontSize:18,opacity:0.6}}>×</button>
          </div>
          <div style={{fontSize:12,color:'#6ee7b7',opacity:0.7}}>
            {mode === 'signin' ? 'Welcome back — sign in to continue' : 'Create your account — 10 free credits'}
          </div>
        </div>

        <div style={{padding:'20px 24px'}}>
          {sent ? (
            <div style={{textAlign:'center',padding:'20px 0'}}>
              <div style={{fontSize:32,marginBottom:10}}>📧</div>
              <div style={{fontSize:14,fontWeight:700,color:'#34d399',marginBottom:6}}>Check your email</div>
              <div style={{fontSize:12,color:'#6ee7b7',opacity:0.7}}>We sent a confirmation link to <strong style={{color:'#f0fdf4'}}>{email}</strong></div>
            </div>
          ) : (
            <>
              {/* OAuth buttons */}
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
                <button onClick={()=>handleOAuth('google')} disabled={!!loading}
                  style={{width:'100%',padding:'11px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#f0fdf4',fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,transition:'all 0.15s',opacity:loading?0.7:1}}>
                  {loading==='google' ? '⟳ Connecting...' : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Continue with Google
                    </>
                  )}
                </button>

                <button onClick={()=>handleOAuth('github')} disabled={!!loading}
                  style={{width:'100%',padding:'11px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#f0fdf4',fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,transition:'all 0.15s',opacity:loading?0.7:1}}>
                  {loading==='github' ? '⟳ Connecting...' : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#f0fdf4"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                      Continue with GitHub
                    </>
                  )}
                </button>
              </div>

              {/* Divider */}
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                <div style={{flex:1,height:1,background:'rgba(52,211,153,0.1)'}}/>
                <span style={{fontSize:11,color:'#6ee7b7',opacity:0.5}}>or with email</span>
                <div style={{flex:1,height:1,background:'rgba(52,211,153,0.1)'}}/>
              </div>

              {/* Email form */}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <input value={email} onChange={e=>setEmail(e.target.value)}
                  placeholder="Email address"
                  style={{width:'100%',padding:'10px 12px',background:'rgba(52,211,153,0.04)',border:'1px solid rgba(52,211,153,0.15)',borderRadius:7,color:'#f0fdf4',fontSize:13,outline:'none',fontFamily:'Inter,sans-serif'}}/>
                <input value={password} onChange={e=>setPassword(e.target.value)}
                  type="password" placeholder="Password"
                  onKeyDown={e=>e.key==='Enter'&&handleEmail()}
                  style={{width:'100%',padding:'10px 12px',background:'rgba(52,211,153,0.04)',border:'1px solid rgba(52,211,153,0.15)',borderRadius:7,color:'#f0fdf4',fontSize:13,outline:'none',fontFamily:'Inter,sans-serif'}}/>
                
                {error && <div style={{fontSize:11,color:'#f87171',padding:'6px 10px',background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:5}}>{error}</div>}

                <button onClick={handleEmail} disabled={!!loading}
                  style={{width:'100%',padding:'11px',background:'linear-gradient(135deg,#34d399,#10b981)',border:'none',borderRadius:8,color:'#050a06',fontSize:13,fontWeight:700,cursor:'pointer',boxShadow:'0 0 16px rgba(52,211,153,0.3)',opacity:loading?0.7:1}}>
                  {loading==='email' ? '⟳ Processing...' : mode==='signin' ? '→ Sign In' : '→ Create Account'}
                </button>
              </div>

              {/* Toggle */}
              <div style={{textAlign:'center',marginTop:14,fontSize:12,color:'#6ee7b7',opacity:0.7}}>
                {mode==='signin' ? "Don't have an account? " : "Already have an account? "}
                <button onClick={()=>{setMode(mode==='signin'?'signup':'signin');setError('')}} style={{background:'none',border:'none',color:'#34d399',cursor:'pointer',fontSize:12,fontWeight:600}}>
                  {mode==='signin' ? 'Sign up free' : 'Sign in'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:'12px 24px',borderTop:'1px solid rgba(52,211,153,0.08)',display:'flex',justifyContent:'center',gap:16}}>
          {['Privacy','Terms','Docs'].map(l => (
            <a key={l} href="#" style={{fontSize:11,color:'#6ee7b7',opacity:0.5,textDecoration:'none'}}>{l}</a>
          ))}
        </div>
      </div>
    </div>
  )
}
