'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { GeistSans } from 'geist/font/sans'
import { CryptoCheckLogo } from '@/components/brand/CryptoCheckLogo'
import { supabase } from '@/lib/supabase'

/** Injected as raw CSS to avoid hydration mismatches from React normalizing `<style>` text children. */
const LANDING_PAGE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700;800&display=swap');
@keyframes fadeInUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
@keyframes lp-pulse { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(32,178,170,0.4); } 50% { opacity:0.6; box-shadow:0 0 0 4px rgba(32,178,170,0); } }
@keyframes lp-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
html { scroll-behavior:smooth; }
.lp-cta:hover { transform:translateY(-2px); box-shadow:0 0 40px rgba(32,178,170,0.45),0 8px 30px rgba(0,0,0,0.4) !important; }
.lp-feature-card:hover { border-color:rgba(32,178,170,0.3) !important; transform:translateY(-2px); }
.lp-float-badge { animation:lp-float 3s ease-in-out infinite; }
.lp-float-badge-delay { animation:lp-float 3s ease-in-out infinite 1.5s; }
.lp-hero-grid { grid-template-columns:1fr 1fr; }
.lp-steps-grid { grid-template-columns:repeat(3,1fr); }
.lp-features-grid { grid-template-columns:repeat(3,1fr); }
.lp-stats-grid { grid-template-columns:repeat(4,1fr); }
@media (max-width:900px) {
  .lp-hero-grid { grid-template-columns:1fr !important; }
  .lp-steps-grid { grid-template-columns:1fr !important; }
  .lp-features-grid { grid-template-columns:1fr !important; }
  .lp-stats-grid { grid-template-columns:repeat(2,1fr) !important; }
  .lp-institutional-grid { grid-template-columns:1fr !important; }
  .lp-nav-link { display:none !important; }
  .lp-mobile-nav { display:flex !important; }
  .lp-float-badge,.lp-float-badge-delay { display:none !important; }
}
::-webkit-scrollbar { width:6px; }
::-webkit-scrollbar-track { background:#000; }
::-webkit-scrollbar-thumb { background:rgba(32,178,170,0.3); border-radius:3px; }
`.trim()

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const h = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  function handleGoogleSignup() {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase()
      const inAppWallet = ['phantom', 'metamask', 'trust', 'coinbasewallet', 'tokenpocket', 'okx', 'rainbow'].some(s => ua.includes(s))
      if (inAppWallet) {
        const appUrl = 'https://www.cryptocheckai.com/app'
        navigator.clipboard?.writeText(appUrl).catch(() => {})
        alert('Google sign-in may be blocked in wallet browsers. Link copied — open in Safari/Chrome: ' + appUrl)
        return
      }
    }
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://www.cryptocheckai.com/app', queryParams: { access_type: 'offline', prompt: 'consent' } },
    })
  }

  const stats = [
    { value: '$4.2M+', label: 'Protected from rugs' },
    { value: '14,902', label: 'Tokens scanned today' },
    { value: '97%', label: 'Rug detection accuracy' },
    { value: '<200ms', label: 'Real-time response' },
  ]
  const steps = [
    { num: '01', title: 'Sign Up Free', icon: '⚡', accent: '#20b2aa', desc: 'Create your account in 10 seconds. Get 10 Neural Scan credits instantly — no card required.' },
    { num: '02', title: 'Scan Any Token', icon: '🔬', accent: '#00d4aa', desc: 'Paste a Solana mint address. Our AI analyzes holders, liquidity, mint authority, and 47+ risk signals.' },
    { num: '03', title: 'Trade with Whale Mode', icon: '🐋', accent: '#d4af37', desc: 'Unlock Auto-Sniper & Whale Tracking. Pay only a 0.5% performance fee on profitable trades — nothing upfront.' },
  ]
  const features = [
    { icon: '🧠', title: 'Neural Scan V4', desc: 'AI scores 0-100 across 47+ risk vectors. SAFE/SCAM verdict in under 200ms.' },
    { icon: '🐋', title: 'Whale Tracking', desc: 'Follow smart money. See what top wallets are buying before the crowd.' },
    { icon: '🔍', title: 'Rug Forensics Lab', desc: 'Post-mortem analysis on rug pulls. Learn the patterns, avoid the traps.' },
    { icon: '🎯', title: 'AI Auto-Sniper', desc: 'Automated entry on high-confidence signals. 0.5% fee only on profits.' },
    { icon: '📊', title: 'Holder Distribution', desc: 'Visualize top wallets, insider clusters, and concentration risk instantly.' },
    { icon: '⚡', title: 'Live Alpha Feed', desc: 'Real-time whale buys, new pools, rug alerts, and volume spikes.' },
  ]

  return (
    <div className={GeistSans.className} style={{ background:'#000', color:'#e2e8f0', overflow:'hidden', fontFamily:"var(--font-geist-sans), 'IBM Plex Mono', 'JetBrains Mono', monospace" }}>
      {/* NAV */}
      <nav style={{ position:'fixed',top:0,left:0,right:0,zIndex:1000,minHeight:56,display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',padding:'8px clamp(16px,4vw,32px)',background:scrollY>50?'rgba(0,0,0,0.92)':'transparent',backdropFilter:scrollY>50?'blur(20px)':'none',borderBottom:scrollY>50?'1px solid rgba(32,178,170,0.1)':'1px solid transparent',transition:'all 0.3s ease' }}>
        <CryptoCheckLogo />
        <div style={{ display:'flex',alignItems:'center',gap:20 }}>
          <a href="#how-it-works" className="lp-nav-link" style={{ fontSize:11,color:'#8b949e',textDecoration:'none',letterSpacing:'0.05em' }}>How it Works</a>
          <a href="#features" className="lp-nav-link" style={{ fontSize:11,color:'#8b949e',textDecoration:'none',letterSpacing:'0.05em' }}>Features</a>
          <a href="#institutional" className="lp-nav-link" style={{ fontSize:11,color:'#8b949e',textDecoration:'none',letterSpacing:'0.05em' }}>Institutional</a>
          <a href="#demo" className="lp-nav-link" style={{ fontSize:11,color:'#8b949e',textDecoration:'none',letterSpacing:'0.05em' }}>Demo</a>
          <a href="/dashboard" style={{ fontSize:11,color:'#e2e8f0',textDecoration:'none',letterSpacing:'0.06em',fontWeight:600 }}>Dashboard</a>
          <a href="/dashboard/intelligence-terminal" style={{ fontSize:11,color:'#a5b4fc',textDecoration:'none',letterSpacing:'0.06em',fontWeight:600 }}>Terminal</a>
          <a href="/dashboard/compliance" style={{ fontSize:11,color:'#94a3b8',textDecoration:'none',letterSpacing:'0.06em',fontWeight:600 }}>Compliance</a>
          <a href="/pro/dashboard" style={{ fontSize:11,color:'#818cf8',textDecoration:'none',letterSpacing:'0.05em',fontWeight:600 }}>Inst. Terminal</a>
          <a href="/app" style={{ padding:'7px 16px',fontSize:11,fontWeight:700,background:'linear-gradient(135deg,#20b2aa,#00d4aa)',color:'#000',borderRadius:6,textDecoration:'none',letterSpacing:'0.04em' }}>Launch App →</a>
        </div>
        <div className="lp-mobile-nav" style={{ width:'100%',display:'none',flexWrap:'wrap',gap:10,paddingTop:6,alignItems:'center',justifyContent:'flex-start',borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/" style={{ fontSize:11,color:'#e2e8f0',textDecoration:'none',letterSpacing:'0.04em',padding:'6px 10px',borderRadius:6,border:'0.5px solid rgba(255,255,255,0.12)' }}>Home</Link>
          <a href="/app" style={{ fontSize:11,color:'#20b2aa',textDecoration:'none',letterSpacing:'0.04em' }}>App</a>
          <a href="/dashboard" style={{ fontSize:11,color:'#e2e8f0',textDecoration:'none',letterSpacing:'0.04em',fontWeight:600 }}>Dashboard</a>
          <a href="/dashboard/intelligence-terminal" style={{ fontSize:11,color:'#a5b4fc',textDecoration:'none',letterSpacing:'0.04em',fontWeight:600 }}>Terminal</a>
          <a href="/dashboard/compliance" style={{ fontSize:11,color:'#94a3b8',textDecoration:'none',letterSpacing:'0.04em',fontWeight:600 }}>Compliance</a>
          <a href="/landing" style={{ fontSize:11,color:'#8b949e',textDecoration:'none',letterSpacing:'0.04em' }}>Landing page</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight:'100vh',display:'flex',alignItems:'center',position:'relative',overflow:'hidden',paddingTop:'clamp(64px,14vw,96px)' }}>
        <div style={{ position:'absolute',inset:0,pointerEvents:'none',backgroundImage:'linear-gradient(rgba(32,178,170,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(32,178,170,0.03) 1px,transparent 1px)',backgroundSize:'60px 60px' }}/>
        <div style={{ position:'absolute',top:'20%',left:'5%',width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle,rgba(32,178,170,0.08) 0%,transparent 70%)',filter:'blur(60px)',pointerEvents:'none' }}/>
        <div className="lp-hero-grid" style={{ maxWidth:1280,margin:'0 auto',padding:'40px clamp(16px,4vw,32px)',display:'grid',gap:40,alignItems:'center',width:'100%',position:'relative',zIndex:1 }}>
          <div style={{ animation:'fadeInUp 0.8s ease-out' }}>
            <div style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'6px 14px',borderRadius:20,background:'rgba(32,178,170,0.08)',border:'1px solid rgba(32,178,170,0.2)',marginBottom:24 }}>
              <span style={{ width:6,height:6,borderRadius:'50%',background:'#20b2aa',animation:'lp-pulse 2s infinite' }}/>
              <span style={{ fontSize:10,color:'#20b2aa',fontWeight:600,letterSpacing:'0.06em' }}>AI-POWERED SOLANA INTELLIGENCE · LIVE ON MAINNET</span>
            </div>
            <h1 style={{ fontSize:'clamp(32px,5vw,52px)',fontWeight:800,lineHeight:1.1,color:'#fff',margin:'0 0 8px',letterSpacing:'-0.03em' }}>
              Neural-Grade Security{' '}<span style={{ background:'linear-gradient(135deg,#20b2aa,#00d4aa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>for Solana Assets</span>
            </h1>
            <p style={{ fontSize:'clamp(13px,1.5vw,16px)',color:'#8b949e',lineHeight:1.7,margin:'20px 0 32px',maxWidth:480 }}>
              Instantly scan any token with our Neural Scanner before you buy. AI analyzes 47+ risk signals in real-time.{' '}<span style={{ color:'#20b2aa',fontWeight:700 }}>Get 10 FREE Scans on signup.</span>
            </p>
            <div style={{ display:'flex',flexWrap:'wrap',gap:12,marginBottom:32 }}>
              <button onClick={handleGoogleSignup} className="lp-cta" style={{ padding:'14px 28px',fontSize:14,fontWeight:700,background:'linear-gradient(135deg,#20b2aa,#00d4aa)',border:'none',borderRadius:8,color:'#000',cursor:'pointer',letterSpacing:'0.03em',boxShadow:'0 0 30px rgba(32,178,170,0.3),0 4px 20px rgba(0,0,0,0.3)',fontFamily:"'IBM Plex Mono',monospace",transition:'transform 0.2s,box-shadow 0.2s' }}>⚡ Start Free — 10 Credits</button>
              <a href="#features" style={{ padding:'14px 28px',fontSize:14,fontWeight:700,background:'transparent',border:'1px solid rgba(32,178,170,0.3)',borderRadius:8,color:'#20b2aa',textDecoration:'none',display:'flex',alignItems:'center',fontFamily:"'IBM Plex Mono',monospace" }}>See Features →</a>
            </div>
            <div className="lp-stats-grid" style={{ display:'grid',gap:16 }}>
              {stats.map((s,i) => (
                <div key={i} style={{ animation:`fadeInUp 0.6s ease-out ${i*100}ms both` }}>
                  <div style={{ fontSize:'clamp(18px,2vw,22px)',fontWeight:800,color:'#20b2aa',letterSpacing:'-0.02em' }}>{s.value}</div>
                  <div style={{ fontSize:9,color:'#6e7681',letterSpacing:'0.08em',marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position:'relative',animation:'fadeInUp 1s ease-out 0.3s both' }}>
            <div style={{ position:'absolute',inset:-40,background:'radial-gradient(circle at center,rgba(32,178,170,0.12) 0%,transparent 60%)',filter:'blur(40px)',pointerEvents:'none' }}/>
            <Image src="/images/robot-hero.png" alt="CryptoCheck AI" width={520} height={700} priority style={{ width:'100%',height:'auto',maxWidth:520,borderRadius:16,position:'relative',zIndex:1,filter:'drop-shadow(0 20px 60px rgba(32,178,170,0.2))' }}/>
            <div className="lp-float-badge" style={{ position:'absolute',bottom:'8%',left:-10,zIndex:2,background:'rgba(0,0,0,0.88)',backdropFilter:'blur(10px)',border:'1px solid rgba(32,178,170,0.25)',borderRadius:10,padding:'10px 16px' }}>
              <div style={{ fontSize:9,color:'#6e7681',letterSpacing:'0.1em',marginBottom:2 }}>NEURAL SCORE</div>
              <div style={{ display:'flex',alignItems:'center',gap:8 }}><span style={{ fontSize:22,fontWeight:800,color:'#00d4aa' }}>78</span><span style={{ fontSize:10,color:'#00d4aa',fontWeight:700,padding:'2px 6px',background:'rgba(0,212,170,0.1)',borderRadius:4 }}>LOW RISK</span></div>
            </div>
            <div className="lp-float-badge-delay" style={{ position:'absolute',top:'10%',right:-10,zIndex:2,background:'rgba(0,0,0,0.88)',backdropFilter:'blur(10px)',border:'1px solid rgba(212,175,55,0.25)',borderRadius:10,padding:'10px 16px' }}>
              <div style={{ fontSize:9,color:'#6e7681',letterSpacing:'0.1em',marginBottom:2 }}>RUG PROBABILITY</div>
              <div style={{ fontSize:18,fontWeight:800,color:'#ff4444' }}>12% <span style={{ fontSize:10,color:'#00d4aa' }}>SAFE</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding:'clamp(60px,10vw,120px) clamp(16px,4vw,32px)',background:'linear-gradient(180deg,#000 0%,#050a06 100%)' }}>
        <div style={{ maxWidth:1100,margin:'0 auto' }}>
          <div style={{ textAlign:'center',marginBottom:'clamp(32px,6vw,64px)' }}>
            <div style={{ fontSize:10,fontWeight:700,letterSpacing:'0.2em',color:'#20b2aa',marginBottom:12 }}>HOW IT WORKS</div>
            <h2 style={{ fontSize:'clamp(24px,3.5vw,36px)',fontWeight:800,color:'#fff',margin:0,letterSpacing:'-0.02em' }}>Scan. Detect. <span style={{ color:'#20b2aa' }}>Protect.</span></h2>
            <p style={{ fontSize:14,color:'#6e7681',marginTop:12 }}>No subscriptions. No upfront fees. Pay only for what you use.</p>
          </div>
          <div className="lp-steps-grid" style={{ display:'grid',gap:24 }}>
            {steps.map((step,i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.02)',border:`1px solid rgba(${step.accent==='#d4af37'?'212,175,55':'32,178,170'},0.15)`,borderRadius:12,padding:'clamp(20px,3vw,32px) clamp(16px,2.5vw,28px)',position:'relative',overflow:'hidden',transition:'border-color 0.3s,background 0.3s' }}>
                <div style={{ position:'absolute',top:-20,right:-10,fontSize:80,fontWeight:900,color:'rgba(255,255,255,0.02)',lineHeight:1 }}>{step.num}</div>
                <div style={{ fontSize:28,marginBottom:12 }}>{step.icon}</div>
                <div style={{ fontSize:10,fontWeight:700,letterSpacing:'0.15em',color:step.accent,marginBottom:8 }}>STEP {step.num}</div>
                <h3 style={{ fontSize:20,fontWeight:700,color:'#fff',margin:'0 0 10px',letterSpacing:'-0.01em' }}>{step.title}</h3>
                <p style={{ fontSize:13,color:'#8b949e',lineHeight:1.6,margin:0 }}>{step.desc}</p>
                {i===2 && <div style={{ marginTop:16,padding:'8px 12px',background:'rgba(212,175,55,0.08)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:6,fontSize:11,color:'#d4af37',fontWeight:600 }}>💰 0.5% fee only on profitable trades</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding:'clamp(60px,10vw,100px) clamp(16px,4vw,32px)',background:'#000' }}>
        <div style={{ maxWidth:1100,margin:'0 auto' }}>
          <div style={{ textAlign:'center',marginBottom:'clamp(32px,6vw,56px)' }}>
            <div style={{ fontSize:10,fontWeight:700,letterSpacing:'0.2em',color:'#20b2aa',marginBottom:12 }}>FEATURES</div>
            <h2 style={{ fontSize:'clamp(24px,3.5vw,36px)',fontWeight:800,color:'#fff',margin:0 }}>Institutional-Grade <span style={{ color:'#20b2aa' }}>Intelligence</span></h2>
          </div>
          <div className="lp-features-grid" style={{ display:'grid',gap:20 }}>
            {features.map((f,i) => (
              <div key={i} className="lp-feature-card" style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10,padding:24,transition:'border-color 0.3s,transform 0.3s' }}>
                <div style={{ fontSize:24,marginBottom:12 }}>{f.icon}</div>
                <h3 style={{ fontSize:15,fontWeight:700,color:'#fff',margin:'0 0 6px' }}>{f.title}</h3>
                <p style={{ fontSize:12,color:'#6e7681',lineHeight:1.6,margin:0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INSTITUTIONAL / DEVELOPER */}
      <section id="institutional" style={{ padding:'clamp(56px,9vw,96px) clamp(16px,4vw,32px)',background:'linear-gradient(180deg,#050a06 0%,#030306 100%)',borderTop:'1px solid rgba(99,102,241,0.12)',borderBottom:'1px solid rgba(99,102,241,0.08)' }}>
        <div style={{ maxWidth:1100,margin:'0 auto',display:'grid',gap:28,gridTemplateColumns:'minmax(0,1.1fr) minmax(0,0.9fr)',alignItems:'center' }} className="lp-institutional-grid">
          <div>
            <div style={{ fontSize:10,fontWeight:700,letterSpacing:'0.2em',color:'#818cf8',marginBottom:12 }}>FOR TEAMS &amp; DEVELOPERS</div>
            <h2 style={{ fontSize:'clamp(22px,3vw,32px)',fontWeight:800,color:'#fff',margin:0,letterSpacing:'-0.02em' }}>Institutional-grade <span style={{ color:'#a5b4fc' }}>security infrastructure</span></h2>
            <p style={{ fontSize:14,color:'#8b949e',lineHeight:1.7,marginTop:14,maxWidth:520 }}>
              Explainable AI reasoning, fingerprint-matched rug archetypes, and Pro-tier APIs. Built for desks that need evidence, not just a number.
            </p>
            <div style={{ display:'flex',flexWrap:'wrap',gap:12,marginTop:22 }}>
              <a href="/pro/dashboard" style={{ padding:'14px 24px',fontSize:13,fontWeight:700,background:'linear-gradient(135deg,#4f46e5,#6366f1)',color:'#fff',borderRadius:8,textDecoration:'none',letterSpacing:'0.04em',border:'0.5px solid rgba(255,255,255,0.12)',boxShadow:'0 12px 40px rgba(79,70,229,0.25)' }}>Access Institutional Terminal →</a>
              <a href="/app" style={{ padding:'14px 24px',fontSize:13,fontWeight:700,background:'transparent',border:'0.5px solid rgba(129,140,248,0.35)',borderRadius:8,color:'#a5b4fc',textDecoration:'none' }}>Open consumer app</a>
            </div>
          </div>
          <div style={{ background:'rgba(15,23,42,0.5)',border:'0.5px solid rgba(99,102,241,0.2)',borderRadius:12,padding:'20px 22px',backdropFilter:'blur(12px)' }}>
            <div style={{ fontSize:10,letterSpacing:'0.14em',color:'#64748b',marginBottom:10 }}>PRO API</div>
            <pre style={{ margin:0,fontSize:11,color:'#94a3b8',lineHeight:1.6,fontFamily:"'IBM Plex Mono',monospace",whiteSpace:'pre-wrap' }}>{`POST /api/v1/scan/reasoning
Authorization: Bearer cc_live_…

→ ReasoningObject
  evidence[], fingerprint match,
  clusterAnalysis (Pro+)`}</pre>
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="demo" style={{ padding:'clamp(60px,10vw,100px) clamp(16px,4vw,32px)',background:'linear-gradient(180deg,#000 0%,#050a06 100%)' }}>
        <div style={{ maxWidth:1100,margin:'0 auto' }}>
          <div style={{ textAlign:'center',marginBottom:48 }}>
            <div style={{ fontSize:10,fontWeight:700,letterSpacing:'0.2em',color:'#20b2aa',marginBottom:12 }}>LIVE PREVIEW</div>
            <h2 style={{ fontSize:'clamp(24px,3.5vw,36px)',fontWeight:800,color:'#fff',margin:0 }}>See the Scanner in <span style={{ color:'#20b2aa' }}>Action</span></h2>
            <p style={{ fontSize:14,color:'#6e7681',marginTop:12 }}>Real-time Solana token scanning — Helius RPC &amp; Neural Engine V4</p>
          </div>
          <div style={{ background:'#0d1117',border:'1px solid rgba(32,178,170,0.15)',borderRadius:12,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.5),0 0 40px rgba(32,178,170,0.05)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,padding:'12px 16px',background:'#161b22',borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display:'flex',gap:6 }}><div style={{ width:10,height:10,borderRadius:'50%',background:'#ff5f57' }}/><div style={{ width:10,height:10,borderRadius:'50%',background:'#febc2e' }}/><div style={{ width:10,height:10,borderRadius:'50%',background:'#28c840' }}/></div>
              <div style={{ flex:1,textAlign:'center',fontSize:11,color:'#6e7681' }}>cryptocheckai.com</div>
              <div style={{ fontSize:9,color:'#20b2aa',fontWeight:700,padding:'2px 8px',background:'rgba(32,178,170,0.1)',borderRadius:4 }}>● LIVE</div>
            </div>
            <div style={{ height:'clamp(300px,50vw,520px)',position:'relative',overflow:'hidden' }}>
              <iframe src="/app" title="CryptoCheck AI Scanner" style={{ width:'100%',height:'100%',border:'none',pointerEvents:'none' }} loading="lazy"/>
              <div style={{ position:'absolute',inset:0,background:'linear-gradient(180deg,transparent 50%,rgba(0,0,0,0.85) 100%)',display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:32 }}>
                <button onClick={handleGoogleSignup} style={{ padding:'14px 32px',fontSize:14,fontWeight:700,background:'linear-gradient(135deg,#20b2aa,#00d4aa)',border:'none',borderRadius:8,color:'#000',cursor:'pointer',fontFamily:"'IBM Plex Mono',monospace",boxShadow:'0 0 30px rgba(32,178,170,0.4)' }}>⚡ Try It Free — 10 Neural Scans</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding:'clamp(60px,10vw,100px) clamp(16px,4vw,32px)',textAlign:'center',position:'relative' }}>
        <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:600,height:600,borderRadius:'50%',background:'radial-gradient(circle,rgba(32,178,170,0.06) 0%,transparent 60%)',filter:'blur(80px)',pointerEvents:'none' }}/>
        <div style={{ position:'relative',zIndex:1 }}>
          <h2 style={{ fontSize:'clamp(28px,4vw,40px)',fontWeight:800,color:'#fff',margin:'0 0 16px',letterSpacing:'-0.02em' }}>Protect Your Portfolio <span style={{ color:'#20b2aa' }}>Today</span></h2>
          <p style={{ fontSize:15,color:'#6e7681',maxWidth:500,margin:'0 auto 32px' }}>Join thousands of Solana traders who scan before they buy. 10 free Neural Scans. No credit card required.</p>
          <button onClick={handleGoogleSignup} className="lp-cta" style={{ padding:'16px 40px',fontSize:16,fontWeight:700,background:'linear-gradient(135deg,#20b2aa,#00d4aa)',border:'none',borderRadius:8,color:'#000',cursor:'pointer',fontFamily:"'IBM Plex Mono',monospace",boxShadow:'0 0 40px rgba(32,178,170,0.3),0 4px 20px rgba(0,0,0,0.3)',transition:'transform 0.2s,box-shadow 0.2s' }}>⚡ Start Free — 10 Credits</button>
          <div style={{ fontSize:11,color:'#484f58',marginTop:12 }}>No subscription · No credit card · 10 free scans</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding:'40px clamp(16px,4vw,32px)',borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:1100,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:28,height:28,background:'linear-gradient(135deg,#20b2aa,#00d4aa)',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#000' }}>CC</div>
            <span style={{ fontSize:12,color:'#6e7681' }}>© 2026 CryptoCheck AI, Inc. · Delaware C-Corp</span>
          </div>
          <div style={{ display:'flex',gap:20 }}>
            <Link href="/privacy" style={{ fontSize:11,color:'#484f58',textDecoration:'none' }}>Privacy</Link>
            <Link href="/terms" style={{ fontSize:11,color:'#484f58',textDecoration:'none' }}>Terms of Service</Link>
            <Link href="/docs" style={{ fontSize:11,color:'#484f58',textDecoration:'none' }}>Docs</Link>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: LANDING_PAGE_CSS }} />
    </div>
  )
}
