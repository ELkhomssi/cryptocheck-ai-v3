'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AuthModal from '../../components/AuthModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LandingPage() {
  const [pulse, setPulse] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const iv = setInterval(() => setPulse(p => !p), 1500)
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) window.location.replace('/app')
    })
    return () => { clearInterval(iv); subscription.unsubscribe() }
  }, [])

  return (
    <div style={{background:'#050a06',minHeight:'100vh',color:'#e8fef0',fontFamily:'Inter,system-ui,sans-serif',overflowX:'hidden'}}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(52,211,153,0.2);border-radius:2px}
        a{text-decoration:none;color:inherit}
      `}</style>

      {/* NAVBAR */}
      <nav style={{position:'sticky',top:0,zIndex:100,padding:'0 40px',height:58,display:'flex',alignItems:'center',background:'rgba(5,10,6,0.92)',borderBottom:'1px solid rgba(52,211,153,0.08)',backdropFilter:'blur(20px)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <img src="/logo.jpg" alt="CryptoCheck AI" style={{width:28,height:28,borderRadius:7,objectFit:'cover'}}/>
          <span style={{fontSize:15,fontWeight:700,color:'#f0fdf4'}}>CryptoCheck<span style={{color:'#34d399'}}>AI</span></span>
        </div>
        <div style={{display:'flex',gap:2,margin:'0 auto'}}>
          {[['Features','#features'],['Pricing','#pricing'],['Neural Scan','/app'],['Whale Intel','/app']].map(([t,h]) => (
            <a key={t} href={h} style={{padding:'6px 13px',fontSize:13,color:'#6ee7b7',textDecoration:'none',borderRadius:6,opacity:0.8}}>{t}</a>
          ))}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>user?window.location.replace('/app'):setShowAuth(true)} style={{padding:'7px 16px',fontSize:13,color:'#6ee7b7',opacity:0.8,background:'none',border:'none',cursor:'pointer'}}>
            {user ? 'Dashboard →' : 'Sign In'}
          </button>
          <button onClick={()=>user?window.location.replace('/app'):setShowAuth(true)} style={{padding:'8px 18px',fontSize:13,fontWeight:600,background:'linear-gradient(135deg,#34d399,#10b981)',color:'#050a06',borderRadius:8,border:'none',cursor:'pointer',boxShadow:'0 0 16px rgba(52,211,153,0.3)'}}>
            Launch App →
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{position:'relative',padding:'80px 24px 60px',textAlign:'center',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:'800px',height:'600px',background:'radial-gradient(ellipse,rgba(52,211,153,0.12) 0%,transparent 65%)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(52,211,153,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(52,211,153,0.03) 1px,transparent 1px)',backgroundSize:'56px 56px',pointerEvents:'none'}}/>

        <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 16px',background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.2)',borderRadius:20,fontSize:12,color:'#34d399',marginBottom:28,fontWeight:600,position:'relative'}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'#34d399',display:'inline-block',animation:'pulse 1.5s infinite',boxShadow:'0 0 6px #34d399'}}/>
          AI-Powered Solana Intelligence · Live on Mainnet
        </div>

        <h1 style={{fontSize:'clamp(36px,6vw,68px)',fontWeight:800,lineHeight:1.1,letterSpacing:'-0.03em',color:'#f0fdf4',maxWidth:780,margin:'0 auto 20px',position:'relative'}}>
          Stop Losing Money to<br/>
          <span style={{background:'linear-gradient(135deg,#34d399,#6ee7b7,#a7f3d0)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
            Solana Rug Pulls
          </span>
        </h1>

        <p style={{fontSize:'clamp(14px,2vw,17px)',color:'#6ee7b7',maxWidth:520,margin:'0 auto 36px',lineHeight:1.7,opacity:0.85,position:'relative'}}>
          Institutional-grade Neural Scan, AI Predictions, Whale Tracking and Auto-Sniper for serious Solana traders. Powered by Helius RPC.
        </p>

        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap',marginBottom:48,position:'relative'}}>
          <button onClick={()=>user?window.location.replace('/app'):setShowAuth(true)} style={{padding:'13px 28px',background:'linear-gradient(135deg,#34d399,#10b981)',color:'#050a06',borderRadius:10,fontSize:14,fontWeight:700,display:'flex',alignItems:'center',gap:8,border:'none',cursor:'pointer',boxShadow:'0 0 32px rgba(52,211,153,0.4)'}}>
            ⚡ Start Free — 10 Credits
          </button>
          <a href="#features" style={{padding:'13px 26px',background:'rgba(52,211,153,0.06)',color:'#a7f3d0',borderRadius:10,fontSize:14,fontWeight:600,border:'1px solid rgba(52,211,153,0.2)'}}>
            See Features →
          </a>
        </div>

        {/* Stats */}
        <div style={{display:'flex',gap:32,justifyContent:'center',flexWrap:'wrap',marginBottom:52,position:'relative'}}>
          {[['$4.2M+','Protected from rugs'],['14,902','Tokens scanned today'],['97%','Rug detection accuracy'],['<200ms','Real-time response']].map(([v,l]) => (
            <div key={l} style={{textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:700,color:'#34d399',fontFamily:'IBM Plex Mono,monospace',textShadow:'0 0 12px rgba(52,211,153,0.4)'}}>{v}</div>
              <div style={{fontSize:11,color:'#6ee7b7',marginTop:3,opacity:0.7}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Dashboard preview */}
        <div style={{maxWidth:860,margin:'0 auto',background:'#0a110b',border:'1px solid rgba(52,211,153,0.18)',borderRadius:14,overflow:'hidden',boxShadow:'0 0 60px rgba(52,211,153,0.08),0 40px 80px rgba(0,0,0,0.7)',animation:'float 6s ease-in-out infinite'}}>
          <div style={{height:2,background:'linear-gradient(90deg,transparent,#34d399,transparent)'}}/>
          <div style={{background:'#0d1510',borderBottom:'1px solid rgba(52,211,153,0.08)',padding:'0 14px',height:36,display:'flex',alignItems:'center',gap:8}}>
            <div style={{display:'flex',gap:5}}>
              {['#ff5f57','#ffbd2e','#28c840'].map(c => <div key={c} style={{width:10,height:10,borderRadius:'50%',background:c}}/>)}
            </div>
            <div style={{flex:1,display:'flex',justifyContent:'center'}}>
              <div style={{background:'#050a06',border:'1px solid rgba(52,211,153,0.1)',borderRadius:4,padding:'2px 20px',fontSize:10,color:'#6ee7b7'}}>cryptocheckai.com</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:4,fontSize:9,color:'#34d399',fontFamily:'IBM Plex Mono,monospace'}}>
              <span style={{width:5,height:5,borderRadius:'50%',background:'#34d399',animation:'pulse 1.5s infinite'}}/>LIVE
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'185px 1fr',height:220}}>
            <div style={{borderRight:'1px solid rgba(52,211,153,0.06)',padding:8,display:'flex',flexDirection:'column',gap:5}}>
              <div style={{background:'rgba(52,211,153,0.06)',border:'1px solid rgba(52,211,153,0.15)',borderRadius:6,padding:7}}>
                <div style={{fontSize:8,fontWeight:700,color:'#34d399',marginBottom:5,letterSpacing:'0.08em'}}>⚡ NEURAL SCAN V4</div>
                <div style={{background:'#050a06',border:'1px solid rgba(52,211,153,0.1)',borderRadius:3,padding:'4px 7px',fontSize:8,color:'#4ade80',opacity:0.5,marginBottom:4}}>Enter mint address...</div>
                <div style={{background:'linear-gradient(135deg,#34d399,#10b981)',borderRadius:3,padding:4,textAlign:'center',fontSize:8,fontWeight:700,color:'#050a06'}}>⚡ NEURAL SCAN</div>
              </div>
              <div style={{fontSize:8,fontWeight:700,color:'#4ade80',opacity:0.6,padding:'2px 4px',letterSpacing:'0.08em'}}>LIVE ALPHA FEED</div>
              {[['WHALE','rgba(251,191,36,0.12)','#fbbf24','7xKP bought 2.4M BONK'],['RUG','rgba(248,113,113,0.1)','#f87171','MEW holder dump 45%'],['ALPHA','rgba(52,211,153,0.1)','#34d399','POPCAT vol +340%']].map(([tag,bg,color,txt]) => (
                <div key={tag} style={{display:'flex',gap:4,alignItems:'flex-start'}}>
                  <span style={{fontSize:7,padding:'1px 4px',background:bg as string,color:color as string,borderRadius:2,flexShrink:0}}>{tag}</span>
                  <span style={{fontSize:8,color:'#6ee7b7',opacity:0.7}}>{txt}</span>
                </div>
              ))}
            </div>
            <div style={{padding:10,display:'flex',flexDirection:'column',gap:7}}>
              <div style={{background:'rgba(52,211,153,0.04)',border:'1px solid rgba(52,211,153,0.1)',borderRadius:5,padding:'6px 12px',display:'flex',alignItems:'center',gap:8}}>
                <span style={{width:5,height:5,borderRadius:'50%',background:'#34d399',animation:'pulse 1.5s infinite'}}/>
                <span style={{fontSize:8,fontWeight:700,color:'#34d399',letterSpacing:'0.08em'}}>NEURAL PROTECTION ACTIVE</span>
                <span style={{marginLeft:'auto',fontSize:16,fontWeight:700,color:'#34d399',fontFamily:'IBM Plex Mono,monospace'}}>$4,450</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,flex:1}}>
                {[
                  {label:'Neural Score',val:'78',color:'#34d399',sub:'LOW RISK',locked:false},
                  {label:'AI Prediction',val:'82%',color:'#fbbf24',sub:'PRO ONLY',locked:true},
                  {label:'Rug Prob',val:'12%',color:'#34d399',sub:'SAFE',locked:false},
                ].map(c => (
                  <div key={c.label} style={{background:'#0a110b',border:`1px solid ${c.locked?'rgba(251,191,36,0.2)':'rgba(52,211,153,0.1)'}`,borderRadius:7,padding:8,textAlign:'center',position:'relative',overflow:'hidden'}}>
                    {c.locked && <div style={{position:'absolute',inset:0,backdropFilter:'blur(4px)',background:'rgba(5,10,6,0.6)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
                      <div style={{width:20,height:20,background:'linear-gradient(135deg,#fbbf24,#f59e0b)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>🔒</div>
                      <div style={{fontSize:7,color:'#fbbf24',fontWeight:700}}>PRO ONLY</div>
                    </div>}
                    <div style={{fontSize:7,color:'#6ee7b7',opacity:0.6,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.08em'}}>{c.label}</div>
                    <div style={{fontSize:22,fontWeight:700,color:c.color,fontFamily:'IBM Plex Mono,monospace',lineHeight:1}}>{c.val}</div>
                    <div style={{fontSize:7,color:c.color,marginTop:2,fontWeight:700}}>{c.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{padding:'64px 24px',maxWidth:980,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:44}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.14em',color:'#34d399',textTransform:'uppercase',marginBottom:10}}>WHY CRYPTOCHECK AI</div>
          <h2 style={{fontSize:'clamp(26px,4vw,40px)',fontWeight:800,color:'#f0fdf4',letterSpacing:'-0.02em'}}>Everything to trade safely on Solana</h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {[
            {icon:'🧠',title:'Neural Scan V4',badge:'FREE',badgeColor:'#34d399',desc:'AI risk scoring, holder analysis, mint authority checks in under 2 seconds.'},
            {icon:'⚡',title:'AI Prediction Engine',badge:'PRO',badgeColor:'#fbbf24',desc:'5m-15m price predictions using on-chain signals and whale accumulation.'},
            {icon:'🐋',title:'Whale Intelligence',badge:'PRO',badgeColor:'#fbbf24',desc:'Track smart money wallets in real-time. See what insiders buy before pumps.'},
            {icon:'🔐',title:'Rug Forensics Lab',badge:'PRO',badgeColor:'#fbbf24',desc:'Deep contract analysis, bundling detection, liquidity trap identification.'},
            {icon:'🎯',title:'AI Auto-Sniper',badge:'PRO',badgeColor:'#fbbf24',desc:'AI executes trades automatically when high-probability setups appear.'},
            {icon:'📡',title:'Priority Alpha Feed',badge:'PRO',badgeColor:'#fbbf24',desc:'Real-time alerts for whale movements, new pools, and alpha setups.'},
          ].map(f => (
            <div key={f.title} style={{background:'#0a110b',border:'1px solid rgba(52,211,153,0.08)',borderRadius:10,padding:18,transition:'all 0.2s',cursor:'default'}}
              onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor='rgba(52,211,153,0.25)';(e.currentTarget as HTMLDivElement).style.boxShadow='0 0 20px rgba(52,211,153,0.05)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor='rgba(52,211,153,0.08)';(e.currentTarget as HTMLDivElement).style.boxShadow='none'}}>
              <div style={{width:36,height:36,borderRadius:8,background:'rgba(52,211,153,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,marginBottom:10,border:'1px solid rgba(52,211,153,0.12)'}}>{f.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:'#f0fdf4',marginBottom:4}}>{f.title}</div>
              <div style={{fontSize:8,fontWeight:700,padding:'1px 7px',borderRadius:20,background:`rgba(${f.badgeColor==='#34d399'?'52,211,153':'251,191,36'},0.1)`,color:f.badgeColor,border:`1px solid rgba(${f.badgeColor==='#34d399'?'52,211,153':'251,191,36'},0.2)`,display:'inline-block',marginBottom:8,letterSpacing:'0.06em'}}>{f.badge}</div>
              <p style={{fontSize:12,color:'#6ee7b7',lineHeight:1.6,opacity:0.75,margin:0}}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{padding:'60px 24px',maxWidth:800,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:36}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.14em',color:'#34d399',textTransform:'uppercase',marginBottom:10}}>PRICING</div>
          <h2 style={{fontSize:'clamp(24px,4vw,36px)',fontWeight:800,color:'#f0fdf4',letterSpacing:'-0.02em'}}>Simple, transparent pricing</h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
          {[
            {name:'Starter',price:'$5',period:'one-time',color:'#6ee7b7',border:'rgba(110,231,183,0.15)',bg:'transparent',badge:null,features:['10 Neural Scans','Rug Detection','Valid 30 days'],cta:'Get Started',btnStyle:{background:'rgba(52,211,153,0.08)',color:'#34d399',border:'1px solid rgba(52,211,153,0.2)'}},
            {name:'Pro',price:'$30',period:'/month',color:'#34d399',border:'rgba(52,211,153,0.4)',bg:'rgba(52,211,153,0.03)',badge:'MOST POPULAR',features:['Unlimited Credits','AI Predictions','Auto-Sniper Bot','Whale Tracking','Forensics Lab'],cta:'Upgrade to Pro',btnStyle:{background:'linear-gradient(135deg,#34d399,#10b981)',color:'#050a06',border:'none'}},
            {name:'Whale',price:'FREE',period:'0.5% success fee',color:'#6ee7b7',border:'rgba(52,211,153,0.2)',bg:'transparent',badge:'NO MONTHLY FEE',features:['Everything in Pro','Zero monthly cost','0.5% on profits only','VIP Telegram'],cta:'Apply for Whale',btnStyle:{background:'rgba(52,211,153,0.06)',color:'#34d399',border:'1px solid rgba(52,211,153,0.2)'}},
          ].map(pl => (
            <div key={pl.name} style={{background:pl.bg||'#0a110b',border:`1.5px solid ${pl.border}`,borderRadius:10,padding:18,position:'relative',transition:'transform 0.2s',transform:pl.badge==='MOST POPULAR'?'translateY(-4px)':'none',boxShadow:pl.badge==='MOST POPULAR'?'0 0 28px rgba(52,211,153,0.1)':'none'}}>
              {pl.badge && <div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',background:pl.badge==='MOST POPULAR'?'linear-gradient(135deg,#34d399,#10b981)':'rgba(52,211,153,0.12)',color:pl.badge==='MOST POPULAR'?'#050a06':'#34d399',fontSize:8,fontWeight:700,padding:'2px 12px',borderRadius:10,whiteSpace:'nowrap',letterSpacing:'0.06em',border:pl.badge==='MOST POPULAR'?'none':'1px solid rgba(52,211,153,0.25)'}}>{pl.badge}</div>}
              <div style={{fontSize:12,fontWeight:700,color:pl.color,marginBottom:5}}>{pl.name}</div>
              <div style={{fontSize:26,fontWeight:800,color:pl.color,fontFamily:'IBM Plex Mono,monospace',lineHeight:1,marginBottom:2}}>{pl.price}</div>
              <div style={{fontSize:11,color:'#6ee7b7',opacity:0.6,marginBottom:14}}>{pl.period}</div>
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
                {pl.features.map(f => <div key={f} style={{display:'flex',gap:6,fontSize:11,color:'#6ee7b7',opacity:0.8,alignItems:'center'}}><span style={{color:'#34d399',fontSize:10}}>✓</span>{f}</div>)}
              </div>
              <button onClick={()=>user?window.location.replace('/app'):setShowAuth(true)} style={{display:'block',padding:'9px',borderRadius:7,textAlign:'center',fontSize:12,fontWeight:700,...(pl as any).btnStyle,border:'none',cursor:'pointer'}}>
                {pl.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{padding:'64px 24px',textAlign:'center',position:'relative'}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at center,rgba(52,211,153,0.07) 0%,transparent 65%)',pointerEvents:'none'}}/>
        <h2 style={{fontSize:'clamp(26px,4vw,40px)',fontWeight:800,color:'#f0fdf4',marginBottom:14,position:'relative'}}>
          Start protecting your <span style={{color:'#34d399'}}>Solana portfolio</span> today
        </h2>
        <p style={{fontSize:14,color:'#6ee7b7',marginBottom:28,opacity:0.8,position:'relative'}}>Join thousands of traders using AI to trade smarter</p>
        <button onClick={()=>user?window.location.replace('/app'):setShowAuth(true)} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'14px 32px',background:'linear-gradient(135deg,#34d399,#10b981)',color:'#050a06',borderRadius:10,fontSize:14,fontWeight:700,border:'none',cursor:'pointer',boxShadow:'0 0 36px rgba(52,211,153,0.4)',position:'relative'}}>
          ⚡ Launch App Free — 10 Credits
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{borderTop:'1px solid rgba(52,211,153,0.08)',padding:'20px 40px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <img src="/logo.jpg" alt="CryptoCheck AI" style={{width:28,height:28,borderRadius:7,objectFit:'cover'}}/>
          <span style={{fontSize:13,fontWeight:600,color:'#f0fdf4'}}>CryptoCheck AI</span>
          <span style={{fontSize:11,color:'#4ade80',opacity:0.4}}>© 2026</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{width:5,height:5,borderRadius:'50%',background:'#34d399',display:'inline-block',animation:'pulse 1.5s infinite'}}/>
          <span style={{fontSize:10,color:'#34d399',fontFamily:'IBM Plex Mono,monospace',fontWeight:700}}>LIVE · Solana Mainnet</span>
        </div>
        <div style={{display:'flex',gap:16}}>
          {['Privacy','Terms','Docs','Contact'].map(l => (
            <a key={l} href="#" style={{fontSize:11,color:'#6ee7b7',opacity:0.5}}>{l}</a>
          ))}
        </div>
      </footer>
      {showAuth && <AuthModal onClose={()=>setShowAuth(false)} onSuccess={(u)=>{setUser(u);window.location.replace('/app')}} />}
    </div>
  )
}
