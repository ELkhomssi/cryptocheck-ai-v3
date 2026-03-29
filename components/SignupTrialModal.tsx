'use client'
import { useState, useRef, useEffect } from 'react'

interface Props {
  walletAddress: string | null
  isConnected: boolean
  isConnecting: boolean
  onConnect: () => void
  onSuccess: (data: { trialStart: string; daysRemaining: number; displayTime: string }) => void
}

function getDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr'
  const stored = localStorage.getItem('cc_device_id')
  if (stored) return stored
  const id = 'dev_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36)
  localStorage.setItem('cc_device_id', id)
  return id
}

export default function SignupTrialModal({ walletAddress, isConnected, isConnecting, onConnect, onSuccess }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activating, setActivating] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isConnected && walletAddress) setTimeout(() => emailRef.current?.focus(), 100)
  }, [isConnected, walletAddress])

  async function handleActivate() {
    setError('')
    if (!email.trim()) { setError('Please enter your email address.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email.'); return }
    if (!walletAddress) { setError('Please connect your wallet first.'); return }
    setLoading(true); setActivating(true)
    try {
      const res = await fetch('/api/signup-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, email: email.trim().toLowerCase(), deviceId: getDeviceId() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Activation failed')
      localStorage.setItem('cc_trial_start', data.trialStart)
      localStorage.setItem('cc_trial_activated', '1')
      localStorage.setItem('cc_user_email', email.trim().toLowerCase())
      localStorage.setItem('cc_wallet', walletAddress)
      onSuccess({ trialStart: data.trialStart, daysRemaining: data.daysRemaining, displayTime: data.displayTime })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activation failed. Try again.')
      setActivating(false)
    } finally { setLoading(false) }
  }

  const S = {
    overlay: { position:'fixed' as const, inset:0, zIndex:10000, background:'rgba(2,4,14,0.97)', backdropFilter:'blur(20px)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'IBM Plex Mono,monospace' },
    glow: { position:'absolute' as const, top:'15%', left:'50%', transform:'translateX(-50%)', width:500, height:500, background:'radial-gradient(circle,rgba(91,95,239,0.1) 0%,transparent 70%)', pointerEvents:'none' as const },
    box: { background:'linear-gradient(160deg,#060919 0%,#09102a 100%)', border:'1px solid rgba(91,95,239,0.2)', borderRadius:14, padding:'32px 28px', maxWidth:420, width:'90%', position:'relative' as const, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.7)' },
    topLine: { position:'absolute' as const, top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,#5b5fef,#0ea5e9,transparent)' },
  }

  return (
    <div style={S.overlay}>
      <div style={S.glow}/>
      <div style={S.box}>
        <div style={S.topLine}/>

        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:22}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
            <svg width="56" height="48" viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="mS" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#c8d8ea"/><stop offset="45%" stopColor="#8aaac4"/><stop offset="100%" stopColor="#4a6e8f"/></linearGradient>
                <linearGradient id="mC" x1="0%" y1="0%" x2="100%" y2="80%"><stop offset="0%" stopColor="#00c8ff"/><stop offset="100%" stopColor="#0090d8"/></linearGradient>
                <linearGradient id="mN" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0070bb"/><stop offset="100%" stopColor="#08306e"/></linearGradient>
              </defs>
              <path d="M 76 22 A 36 36 0 1 0 76 98" fill="none" stroke="url(#mS)" strokeWidth="16" strokeLinecap="round"/>
              <path d="M 64 28 A 25 25 0 0 1 90 50" fill="none" stroke="url(#mC)" strokeWidth="13" strokeLinecap="round"/>
              <path d="M 90 70 A 25 25 0 0 1 64 92" fill="none" stroke="url(#mN)" strokeWidth="13" strokeLinecap="round"/>
              <text x="100" y="65" fontFamily="Inter,sans-serif" fontSize="14" fontWeight="700" fill="#ffffff" letterSpacing="0.5">AI</text>
            </svg>
          </div>
          <div style={{fontSize:17,fontWeight:700,color:'#eef2f8',marginBottom:5}}>Claim Your 4-Day Free Trial</div>
          <div style={{fontSize:10,color:'#5a6478',lineHeight:1.6}}>Connect wallet + email to unlock full access</div>
        </div>

        {/* Features grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:20}}>
          {[['🧠','Neural Scan V4'],['🔐','Rug Forensics'],['🐋','Whale Intel'],['📡','Alpha Feed']].map(([icon,label])=>(
            <div key={label} style={{display:'flex',alignItems:'center',gap:6,background:'rgba(91,95,239,0.05)',border:'1px solid rgba(91,95,239,0.1)',borderRadius:6,padding:'6px 9px'}}>
              <span style={{fontSize:12}}>{icon}</span>
              <span style={{fontSize:9,color:'#8892a4',fontWeight:600}}>{label}</span>
            </div>
          ))}
        </div>

        {/* Step 1 */}
        <div style={{marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:7}}>
            <div style={{width:18,height:18,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:isConnected?'rgba(16,185,129,0.15)':'rgba(91,95,239,0.15)',border:`1px solid ${isConnected?'rgba(16,185,129,0.35)':'rgba(91,95,239,0.35)'}`,fontSize:8,fontWeight:700,color:isConnected?'#10b981':'#8b85f8',flexShrink:0}}>
              {isConnected?'✓':'1'}
            </div>
            <span style={{fontSize:9,fontWeight:700,color:isConnected?'#10b981':'#eef2f8',letterSpacing:'0.06em'}}>
              {isConnected?`CONNECTED — ${walletAddress?.slice(0,6)}…${walletAddress?.slice(-4)}`:'CONNECT WALLET'}
            </span>
          </div>
          {!isConnected&&(
            <button onClick={onConnect} disabled={isConnecting} style={{width:'100%',padding:'10px 0',borderRadius:7,background:isConnecting?'rgba(91,95,239,0.2)':'linear-gradient(135deg,#5b5fef,#4348e0)',border:'1px solid rgba(91,95,239,0.35)',color:'#fff',fontSize:10,fontWeight:700,letterSpacing:'0.07em',cursor:isConnecting?'not-allowed':'pointer',fontFamily:'IBM Plex Mono,monospace',boxShadow:'0 4px 14px rgba(91,95,239,0.3)'}}>
              {isConnecting?'⟳ CONNECTING…':'⚡ CONNECT PHANTOM / SOLFLARE'}
            </button>
          )}
        </div>

        {/* Step 2 */}
        <div style={{marginBottom:14,opacity:isConnected?1:0.4,transition:'opacity 0.3s'}}>
          <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:7}}>
            <div style={{width:18,height:18,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(91,95,239,0.15)',border:'1px solid rgba(91,95,239,0.35)',fontSize:8,fontWeight:700,color:'#8b85f8',flexShrink:0}}>2</div>
            <span style={{fontSize:9,fontWeight:700,color:'#eef2f8',letterSpacing:'0.06em'}}>ENTER EMAIL</span>
          </div>
          <input ref={emailRef} type="email" value={email} onChange={e=>{setEmail(e.target.value);setError('')}} onKeyDown={e=>e.key==='Enter'&&isConnected&&handleActivate()} placeholder="your@email.com" disabled={!isConnected||loading} style={{width:'100%',background:'rgba(255,255,255,0.03)',border:`1px solid ${error?'rgba(239,68,68,0.5)':'rgba(91,95,239,0.18)'}`,borderRadius:6,padding:'9px 13px',color:'#eef2f8',fontFamily:'IBM Plex Mono,monospace',fontSize:11,outline:'none'}}/>
          {error&&<div style={{marginTop:5,fontSize:9,color:'#ef4444'}}>❌ {error}</div>}
        </div>

        {/* Activate */}
        <button onClick={handleActivate} disabled={!isConnected||loading||!email.trim()} style={{width:'100%',padding:'12px 0',borderRadius:7,background:(!isConnected||!email.trim())?'rgba(255,255,255,0.04)':'linear-gradient(135deg,#10b981,#059669)',border:`1px solid ${(isConnected&&email.trim())?'rgba(16,185,129,0.4)':'rgba(255,255,255,0.07)'}`,color:(!isConnected||!email.trim())?'#5a6478':'#fff',fontSize:11,fontWeight:700,letterSpacing:'0.08em',cursor:(!isConnected||loading||!email.trim())?'not-allowed':'pointer',fontFamily:'IBM Plex Mono,monospace',boxShadow:(isConnected&&email.trim()&&!loading)?'0 4px 20px rgba(16,185,129,0.25)':'none',transition:'all 0.2s'}}>
          {activating?'⟳ ACTIVATING…':'🚀 ACTIVATE 4-DAY FREE TRIAL'}
        </button>

        <div style={{fontSize:8,color:'#3d4558',textAlign:'center',marginTop:10,lineHeight:1.6}}>No credit card · Cancel anytime · DYOR</div>
      </div>
    </div>
  )
}
