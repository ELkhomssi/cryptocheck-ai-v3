'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AuthModal from '../../components/AuthModal'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const T = '#20b2aa', IF = "'Inter',sans-serif", MF = "'JetBrains Mono',monospace"

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState(false)
  const [user, setUser] = useState(null)
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null)
      if (s?.user) window.location.replace('/app')
    })
    return () => subscription.unsubscribe()
  }, [])
  const go = () => user ? window.location.replace('/app') : setShowAuth(true)
  return (
    <div style={{ background: '#000', color: '#e2e8f0', fontFamily: IF, minHeight: '100vh', fontWeight: 300 }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, height: 48, background: 'rgba(0,0,0,0.95)', borderBottom: '1px solid rgba(32,178,170,0.12)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src='/logo.jpg' alt='logo' style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', fontFamily: IF }}>CryptoCheck<span style={{ color: T }}>AI</span></span>
        </div>
        <div style={{ display: 'flex', marginLeft: 20 }}>
          {['Features', 'Pricing', 'Neural Scan', 'Whale Intel'].map(t => (
            <a key={t} href='#' style={{ padding: '5px 14px', fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 400, textDecoration: 'none', fontFamily: IF }}>{t}</a>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={go} style={{ padding: '5px 14px', fontSize: 12, color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: IF }}>{user ? 'Dashboard' : 'Sign In'}</button>
          <button onClick={go} style={{ padding: '7px 18px', background: T, color: '#000', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: IF }}>Launch App</button>
        </div>
      </nav>
      <section style={{ minHeight: '88vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, background: 'radial-gradient(circle,rgba(32,178,170,0.08) 0%,transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(32,178,170,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(32,178,170,0.02) 1px,transparent 1px)', backgroundSize: '56px 56px', pointerEvents: 'none' }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 14px', background: 'rgba(32,178,170,0.08)', border: '1px solid rgba(32,178,170,0.18)', borderRadius: 20, fontSize: 10, color: T, marginBottom: 32, letterSpacing: '0.06em', fontFamily: MF }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: T, display: 'inline-block' }} /> LIVE ON SOLANA MAINNET
        </div>
        <h1 style={{ fontSize: 'clamp(38px,6vw,72px)', fontWeight: 800, lineHeight: 1.03, letterSpacing: '-0.03em', maxWidth: 840, margin: '0 auto 20px', fontFamily: IF }}>
          <span style={{ color: '#fff' }}>SCAN AND PROTECT</span><br />
          <span style={{ color: T }}>SOLANA TOKENS</span><br />
          <span style={{ color: '#fff' }}>AT LIGHTNING SPEED</span>
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', maxWidth: 500, margin: '0 auto 36px', lineHeight: 1.8, fontWeight: 300, fontFamily: IF }}>Neural AI · Rug Detection · Whale Tracking · Auto-Sniper</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 48 }}>
          <button onClick={go} style={{ padding: '13px 30px', background: T, color: '#000', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: IF, boxShadow: '0 0 32px rgba(32,178,170,0.3)' }}>Launch App Free</button>
          <a href='#features' style={{ padding: '13px 24px', background: 'rgba(32,178,170,0.06)', color: 'rgba(32,178,170,0.8)', border: '1px solid rgba(32,178,170,0.18)', borderRadius: 5, fontSize: 13, textDecoration: 'none', fontFamily: IF }}>Documentation</a>
        </div>
        <div style={{ display: 'flex', marginBottom: 52, border: '1px solid rgba(32,178,170,0.12)', borderRadius: 5, overflow: 'hidden' }}>
          {[['4.2M+','PROTECTED'],['14902','SCANNED'],['97%','ACCURACY'],['200ms','RESPONSE']].map(([v,l]) => (
            <div key={l} style={{ padding: '12px 24px', borderRight: '1px solid rgba(32,178,170,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T, fontFamily: MF }}>{v}</div>
              <div style={{ fontSize: 9, color: 'rgba(32,178,170,0.3)', marginTop: 4, letterSpacing: '0.1em', fontFamily: MF }}>{l}</div>
            </div>
          ))}
        </div>
      </section>
      <section id='features' style={{ padding: '72px 24px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', color: T, marginBottom: 12, fontFamily: MF }}>WHY CRYPTOCHECK AI</div>
          <h2 style={{ fontSize: 'clamp(24px,4vw,42px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', fontFamily: IF }}>Professional tools for<br /><span style={{ color: T }}>serious Solana traders</span></h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', border: '1px solid rgba(32,178,170,0.08)', borderRadius: 6, overflow: 'hidden' }}>
          {[{icon:'🧠',t:'Neural Scan V4',b:'FREE',pro:false,d:'AI risk scoring in under 2s.'},{icon:'⚡',t:'AI Prediction',b:'PRO',pro:true,d:'5m-15m predictions.'},{icon:'🐋',t:'Whale Intel',b:'PRO',pro:true,d:'Track smart money.'},{icon:'🔐',t:'Rug Forensics',b:'PRO',pro:true,d:'Deep contract analysis.'},{icon:'🎯',t:'Auto-Sniper',b:'PRO',pro:true,d:'AI executes trades.'},{icon:'📡',t:'Alpha Feed',b:'PRO',pro:true,d:'Real-time whale alerts.'}].map((f,i) => (
            <div key={f.t} style={{ background: '#000', padding: '20px', borderRight: i%3!==2?'1px solid rgba(32,178,170,0.06)':'none', borderBottom: i<3?'1px solid rgba(32,178,170,0.06)':'none' }} onMouseEnter={e=>(e.currentTarget.style.background='rgba(32,178,170,0.02)')} onMouseLeave={e=>(e.currentTarget.style.background='#000')}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4, fontFamily: IF }}>{f.t}</div>
              <span style={{ fontSize: 8, padding: '2px 7px', borderRadius: 2, background: f.pro?'rgba(245,158,11,0.08)':'rgba(32,178,170,0.08)', color: f.pro?'#f59e0b':T, border: '1px solid rgba(32,178,170,0.18)', display: 'inline-block', marginBottom: 8, fontFamily: MF }}>{f.b}</span>
              <p style={{ fontSize: 11, color: 'rgba(32,178,170,0.4)', lineHeight: 1.7, fontWeight: 300, margin: 0 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>
      <section id='pricing' style={{ padding: '64px 24px', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', color: T, marginBottom: 12, fontFamily: MF }}>PRICING</div>
          <h2 style={{ fontSize: 'clamp(22px,3.5vw,36px)', fontWeight: 800, color: '#fff', fontFamily: IF }}>Simple, transparent pricing</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', border: '1px solid rgba(32,178,170,0.08)', borderRadius: 6, overflow: 'hidden' }}>
          {[{n:'STARTER',p:'5',per:'one-time',pop:false,f:['10 Neural Scans','Rug Detection','30 days'],cta:'Get Started'},{n:'PRO',p:'30',per:'/month',pop:true,f:['Unlimited Credits','AI Predictions','Auto-Sniper','Whale Tracking'],cta:'Upgrade to Pro'},{n:'WHALE',p:'FREE',per:'0.5% fee',pop:false,f:['Everything in Pro','0.5% profits','VIP Telegram'],cta:'Apply for Whale'}].map((pl,i) => (
            <div key={pl.n} style={{ background: pl.pop?'#050505':'#000', padding: '22px', borderRight: i<2?'1px solid rgba(32,178,170,0.08)':'none', position: 'relative', overflow: 'hidden' }}>
              {pl.pop && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,#20b2aa,transparent)' }} />}
              {pl.pop && <div style={{ fontSize: 8, fontWeight: 700, color: '#000', background: T, padding: '2px 8px', borderRadius: 2, display: 'inline-block', marginBottom: 8, fontFamily: MF }}>MOST POPULAR</div>}
              <div style={{ fontSize: 10, color: 'rgba(32,178,170,0.5)', marginBottom: 6, letterSpacing: '0.1em', fontFamily: MF }}>{pl.n}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: T, lineHeight: 1, marginBottom: 2, fontFamily: MF }}>{pl.p==='FREE'?'FREE':'$'+pl.p}</div>
              <div style={{ fontSize: 10, color: 'rgba(32,178,170,0.25)', marginBottom: 16 }}>{pl.per}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {pl.f.map(feat => <div key={feat} style={{ fontSize: 11, color: 'rgba(32,178,170,0.5)', display: 'flex', gap: 7, fontWeight: 300 }}><span style={{ color: T }}>+</span>{feat}</div>)}
              </div>
              <button onClick={go} style={{ width: '100%', padding: '8px', background: pl.pop?T:'rgba(32,178,170,0.06)', border: pl.pop?'none':'1px solid rgba(32,178,170,0.18)', borderRadius: 3, color: pl.pop?'#000':T, fontSize: 11, fontWeight: pl.pop?700:400, cursor: 'pointer', fontFamily: IF }}>{pl.cta}</button>
            </div>
          ))}
        </div>
      </section>
      <section style={{ padding: '64px 24px', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,rgba(32,178,170,0.05) 0%,transparent 60%)', pointerEvents: 'none' }} />
        <h2 style={{ fontSize: 'clamp(24px,4vw,40px)', fontWeight: 800, color: '#fff', marginBottom: 12, letterSpacing: '-0.02em', fontFamily: IF, position: 'relative' }}>START PROTECTING YOUR<br /><span style={{ color: T }}>SOLANA PORTFOLIO TODAY</span></h2>
        <p style={{ fontSize: 11, color: 'rgba(32,178,170,0.3)', marginBottom: 24, letterSpacing: '0.08em', fontFamily: MF, position: 'relative' }}>10 FREE SCANS - NO CREDIT CARD</p>
        <button onClick={go} style={{ padding: '13px 30px', background: T, color: '#000', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: IF, position: 'relative' }}>Launch App Free</button>
      </section>
      <footer style={{ borderTop: '1px solid rgba(32,178,170,0.07)', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: '#050505' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <img src='/logo.jpg' alt='logo' style={{ width: 18, height: 18, borderRadius: 3, objectFit: 'cover' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', fontFamily: IF }}>CryptoCheck AI</span>
        </div>
        <span style={{ fontSize: 9, color: T, fontFamily: MF }}>LIVE - SOLANA MAINNET</span>
        <div style={{ display: 'flex', gap: 16 }}>
          {['Privacy','Terms','Docs'].map(l => <a key={l} href='#' style={{ fontSize: 10, color: 'rgba(32,178,170,0.25)', textDecoration: 'none', fontFamily: IF }}>{l}</a>)}
        </div>
      </footer>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={(u) => { setUser(u); window.location.replace('/app') }} />}
    </div>
  )
}