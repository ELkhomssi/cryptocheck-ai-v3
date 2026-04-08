'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AuthModal from '../../components/AuthModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const T = '#20b2aa'
const TD = 'rgba(32,178,170,0.08)'
const TB = 'rgba(32,178,170,0.15)'
const MN = "'JetBrains Mono',monospace"

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) window.location.replace('/app')
    })
    return () => subscription.unsubscribe()
  }, [])

  const go = () => user ? window.location.replace('/app') : setShowAuth(true)

  return (
    <div style={{background:'#000',color:'#e2e8f0',fontFamily:MN,overflowX:'hidden' as const,fontWeight:300}}>
      {/* NAV */}
      <nav style={{position:'sticky' as const,top:0,zIndex:100,height:48,background:'rgba(0,0,0,0.92)',borderBottom:'1px solid rgba(32,178,170,0.15)',backdropFilter:'blur(20px)',display:'flex',alignItems:'center',padding:'0 28px',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <img src="/logo.jpg" alt="logo" style={{width:22,height:22,borderRadius:4,objectFit:'cover' as const}}/>
          <span style={{fontSize:13,fontWeight:500,color:'#fff'}}>CryptoCheck<span style={{color:T}}>AI</span></span>
        </div>
        <div style={{display:'flex',gap:0,marginLeft:14}}>
          {([['Features','#features'],['Pricing','#pricing'],['Docs','#']] as [string,string][]).map(([t,h]) => (
            <a key={t} href={h} style={{padding:'5px 12px',fontSize:11,color:'rgba(32,178,170,0.5)',fontWeight:400,textDecoration:'none',letterSpacing:'0.04em'}}>{t}</a>
          ))}
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={go} style={{padding:'5px 12px',fontSize:11,color:'rgba(32,178,170,0.5)',background:'none',border:'none',cursor:'pointer',fontFamily:MN,fontWeight:400}}>{user?'Dashboard':'Sign In'}</button>
          <button onClick={go} style={{padding:'6px 16px',background:T,color:'#000',border:'none',borderRadius:4,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:MN,letterSpacing:'0.06em'}}>LAUNCH APP</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{minHeight:'88vh',display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center',padding:'60px 24px 40px',textAlign:'center' as const,position:'relative' as const,overflow:'hidden'}}>
        <div style={{position:'absolute' as const,top:'10%',left:'20%',width:320,height:320,background:'radial-gradient(circle,rgba(32,178,170,0.1) 0%,transparent 65%)',pointerEvents:'none' as const}}/>
        <div style={{position:'absolute' as const,inset:0,backgroundImage:'linear-gradient(rgba(32,178,170,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(32,178,170,0.025) 1px,transparent 1px)',backgroundSize:'56px 56px',pointerEvents:'none' as const}}/>

        <div style={{display:'inline-flex',alignItems:'center',gap:7,padding:'4px 12px',background:TD,border:'1px solid rgba(32,178,170,0.15)',borderRadius:20,fontSize:9,color:T,marginBottom:28,letterSpacing:'0.08em',fontWeight:400}}>
          <span style={{width:4,height:4,borderRadius:'50%',background:T,display:'inline-block'}}/>
          LIVE ON SOLANA MAINNET
        </div>

        <h1 style={{fontSize:'clamp(32px,5.5vw,64px)',fontWeight:700,lineHeight:1.05,letterSpacing:'-0.02em',maxWidth:800,margin:'0 auto 18px',fontFamily:MN}}>
          <span style={{color:'#fff',fontWeight:600}}>SCAN AND PROTECT</span><br/>
          <span style={{color:T,fontWeight:700}}>SOLANA TOKENS</span><br/>
          <span style={{color:'#fff',fontWeight:600}}>AT LIGHTNING SPEED</span>
        </h1>

        <p style={{fontSize:12,color:'rgba(32,178,170,0.45)',maxWidth:480,margin:'0 auto 32px',lineHeight:1.8,fontWeight:300,letterSpacing:'0.02em'}}>
          Neural AI · Rug Detection · Whale Tracking · Auto-Sniper<br/>Powered by Helius RPC · Solana Mainnet
        </p>

        <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap' as const,marginBottom:44}}>
          <button onClick={go} style={{padding:'12px 28px',background:T,color:'#000',border:'none',borderRadius:4,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:MN,letterSpacing:'0.06em',boxShadow:'0 0 28px rgba(32,178,170,0.3)'}}>LAUNCH APP FREE</button>
          <a href="#features" style={{padding:'12px 22px',background:TD,color:'rgba(32,178,170,0.7)',border:'1px solid rgba(32,178,170,0.15)',borderRadius:4,fontSize:12,fontWeight:400,letterSpacing:'0.04em',textDecoration:'none'}}>DOCUMENTATION</a>
        </div>

        <div style={{display:'flex',gap:0,marginBottom:48,border:'1px solid rgba(32,178,170,0.15)',borderRadius:4,overflow:'hidden'}}>
          {([['$4.2M+','PROTECTED'],['14,902','SCANNED'],['97%','ACCURACY'],['<200ms','RESPONSE']] as [string,string][]).map(([v,l]) => (
            <div key={l} style={{padding:'10px 20px',borderRight:'1px solid rgba(32,178,170,0.08)',textAlign:'center' as const}}>
              <div style={{fontSize:18,fontWeight:600,color:T,lineHeight:1}}>{v}</div>
              <div style={{fontSize:8,color:'rgba(32,178,170,0.3)',marginTop:3,letterSpacing:'0.1em',fontWeight:400}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Dashboard preview */}
        <div style={{width:'100%',maxWidth:860,margin:'0 auto',background:'#080808',border:'1px solid rgba(32,178,170,0.12)',borderRadius:6,overflow:'hidden',boxShadow:'0 0 60px rgba(32,178,170,0.07),0 40px 80px rgba(0,0,0,0.8)'}}>
          <div style={{height:2,background:'linear-gradient(90deg,transparent,#20b2aa,#2dd4bf,transparent)'}}/>
          <div style={{background:'#0a0a0a',borderBottom:'1px solid rgba(32,178,170,0.07)',padding:'0 12px',height:30,display:'flex',alignItems:'center',gap:8}}>
            <div style={{display:'flex',gap:4}}>{['#ff5f57','#ffbd2e','#28c840'].map(c=><div key={c} style={{width:8,height:8,borderRadius:'50%',background:c}}/>)}</div>
            <div style={{flex:1,display:'flex',justifyContent:'center'}}><div style={{background:'#060606',border:'1px solid rgba(32,178,170,0.08)',borderRadius:2,padding:'2px 14px',fontSize:8,color:'rgba(32,178,170,0.3)',letterSpacing:'0.04em'}}>cryptocheckai.com/app</div></div>
            <span style={{fontSize:8,color:T,letterSpacing:'0.06em'}}>● LIVE</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'150px 1fr 170px',height:190,fontFamily:MN}}>
            <div style={{borderRight:'1px solid rgba(32,178,170,0.06)',padding:8}}>
              <div style={{fontSize:7,color:'rgba(32,178,170,0.25)',letterSpacing:'0.1em',marginBottom:4}}>NEURAL SCAN</div>
              <div style={{background:'#060606',border:'1px solid rgba(32,178,170,0.08)',borderRadius:2,padding:'4px 6px',fontSize:7,color:'rgba(32,178,170,0.25)',marginBottom:3}}>Paste mint...</div>
              <div style={{background:T,borderRadius:2,padding:4,textAlign:'center' as const,fontSize:7,fontWeight:600,color:'#000',letterSpacing:'0.06em',marginBottom:6}}>⚡ SCAN</div>
              {(['BONK +6.8%','WIF -2.1%','POPCAT +15%'] as string[]).map(s=>(
                <div key={s} style={{display:'flex',justifyContent:'space-between',padding:'2px 3px',fontSize:7}}>
                  <span style={{color:'#d4d4d4'}}>{s.split(' ')[0]}</span>
                  <span style={{color:s.includes('-')?'#ef4444':T}}>{s.split(' ')[1]}</span>
                </div>
              ))}
            </div>
            <div style={{padding:8,display:'flex',flexDirection:'column' as const,gap:5}}>
              <div style={{background:'rgba(32,178,170,0.03)',border:'1px solid rgba(32,178,170,0.07)',borderRadius:2,padding:'4px 8px',display:'flex',alignItems:'center',gap:7}}>
                <span style={{width:3,height:3,borderRadius:'50%',background:T}}/>
                <span style={{fontSize:7,fontWeight:500,color:T,letterSpacing:'0.08em'}}>PROTECTION ACTIVE</span>
                <span style={{marginLeft:'auto',fontSize:13,fontWeight:600,color:T}}>$4,450</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4,flex:1}}>
                {[{l:'NEURAL',v:'78',c:T,locked:false},{l:'AI PRED',v:'82%',c:'#f59e0b',locked:true},{l:'RUG PROB',v:'12%',c:T,locked:false}].map(item=>(
                  <div key={item.l} style={{background:'#060606',border:'1px solid rgba(32,178,170,0.07)',borderRadius:3,padding:6,textAlign:'center' as const,position:'relative' as const,overflow:'hidden'}}>
                    {item.locked&&<div style={{position:'absolute' as const,inset:0,background:'rgba(0,0,0,0.65)',display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center',gap:1}}><span style={{fontSize:8}}>🔒</span><span style={{fontSize:6,color:'#f59e0b'}}>PRO</span></div>}
                    <div style={{fontSize:6,color:'rgba(32,178,170,0.3)',marginBottom:2}}>{item.l}</div>
                    <div style={{fontSize:18,fontWeight:600,color:item.c,lineHeight:1}}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{borderLeft:'1px solid rgba(32,178,170,0.06)',padding:8}}>
              <div style={{fontSize:7,color:'rgba(32,178,170,0.25)',marginBottom:4}}>ALPHA FEED</div>
              {[{tag:'WHL',c:'#f59e0b',txt:'7xKP bought BONK'},{tag:'RUG',c:'#ef4444',txt:'MEW dump 45%'},{tag:'ALP',c:T,txt:'POPCAT +340%'}].map(f=>(
                <div key={f.tag} style={{display:'flex',gap:4,fontSize:7,marginBottom:3}}>
                  <span style={{color:f.c,fontWeight:500}}>{f.tag}</span>
                  <span style={{color:'rgba(32,178,170,0.35)',fontWeight:300}}>{f.txt}</span>
                </div>
              ))}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2,marginTop:6}}>
                <div style={{padding:4,background:T,borderRadius:1,textAlign:'center' as const,fontSize:7,fontWeight:600,color:'#000'}}>BUY</div>
                <div style={{padding:4,background:'rgba(239,68,68,0.1)',borderRadius:1,textAlign:'center' as const,fontSize:7,color:'#ef4444'}}>SELL</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{padding:'64px 24px',maxWidth:920px,margin:'0 auto'}}>
        <div style={{textAlign:'center' as const,marginBottom:40}}>
          <div style={{fontSize:9,fontWeight:500,letterSpacing:'0.14em',color:T,marginBottom:10}}>WHY CRYPTOCHECK AI</div>
          <h2 style={{fontSize:'clamp(22px,3.5vw,36px)',fontWeight:600,color:'#fff',letterSpacing:'-0.02em'}}>Professional tools for <span style={{color:T,fontWeight:500}}>serious Solana traders</span></h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',background:'rgba(32,178,170,0.06)',border:'1px solid rgba(32,178,170,0.08)',borderRadius:4,overflow:'hidden'}}>
          {[
            {icon:'🧠',t:'Neural Scan V4',b:'FREE',pro:false,d:'AI risk scoring, mint authority checks in under 2s.'},
            {icon:'⚡',t:'AI Prediction',b:'PRO',pro:true,d:'5m-15m predictions using whale accumulation patterns.'},
            {icon:'🐋',t:'Whale Intel',b:'PRO',pro:true,d:'Track smart money before the pump.'},
            {icon:'🔐',t:'Rug Forensics',b:'PRO',pro:true,d:'Deep contract analysis and bundling detection.'},
            {icon:'🎯',t:'Auto-Sniper',b:'PRO',pro:true,d:'AI executes trades on high-probability setups.'},
            {icon:'📡',t:'Alpha Feed',b:'PRO',pro:true,d:'Real-time alerts for whale movements.'},
          ].map((f,i)=>(
            <div key={f.t} style={{background:'#000',padding:'16px',borderRight:i%3!==2?'1px solid rgba(32,178,170,0.06)':'none',borderBottom:i<3?'1px solid rgba(32,178,170,0.06)':'none',transition:'background 0.15s'}}
              onMouseEnter={e=>(e.currentTarget.style.background='rgba(32,178,170,0.02)')}
              onMouseLeave={e=>(e.currentTarget.style.background='#000')}>
              <div style={{fontSize:16,marginBottom:6}}>{f.icon}</div>
              <div style={{fontSize:11,fontWeight:500,color:'#e2e8f0',marginBottom:3}}>{f.t}</div>
              <div style={{fontSize:7,padding:'1px 6px',borderRadius:2,background:f.pro?'rgba(245,158,11,0.06)':TD,color:f.pro?'#f59e0b':T,border:'1px solid rgba(32,178,170,0.15)',display:'inline-block',marginBottom:7,letterSpacing:'0.08em',fontWeight:500}}>{f.b}</div>
              <p style={{fontSize:10,color:'rgba(32,178,170,0.4)',lineHeight:1.7,fontWeight:300,margin:0}}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{padding:'56px 24px',maxWidth:720px,margin:'0 auto'}}>
        <div style={{textAlign:'center' as const,marginBottom:32}}>
          <div style={{fontSize:9,fontWeight:500,letterSpacing:'0.14em',color:T,marginBottom:10}}>PRICING</div>
          <h2 style={{fontSize:'clamp(20px,3.5vw,32px)',fontWeight:600,color:'#fff',letterSpacing:'-0.02em'}}>Simple, transparent pricing</h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',background:'rgba(32,178,170,0.06)',border:'1px solid rgba(32,178,170,0.08)',borderRadius:4,overflow:'hidden'}}>
          {[
            {n:'STARTER',p:'$5',per:'one-time',pop:false,features:['10 Neural Scans','Rug Detection','Valid 30 days'],cta:'GET STARTED'},
            {n:'PRO',p:'$30',per:'/month',pop:true,features:['Unlimited Credits','AI Predictions','Auto-Sniper','Whale Tracking'],cta:'UPGRADE TO PRO'},
            {n:'WHALE',p:'FREE',per:'0.5% fee',pop:false,features:['Everything in Pro','0.5% profits only','VIP Telegram'],cta:'APPLY FOR WHALE'},
          ].map((pl,i)=>(
            <div key={pl.n} style={{background:pl.pop?'#050505':'#000',padding:'18px',borderRight:i<2?'1px solid rgba(32,178,170,0.08)':'none',position:'relative' as const,overflow:'hidden'}}>
              {pl.pop&&<div style={{position:'absolute' as const,top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,#20b2aa,transparent)'}}/>}
              {pl.pop&&<div style={{fontSize:7,fontWeight:600,color:'#000',background:T,padding:'1px 7px',borderRadius:2,display:'inline-block',marginBottom:6,letterSpacing:'0.08em'}}>MOST POPULAR</div>}
              <div style={{fontSize:9,fontWeight:500,color:'rgba(32,178,170,0.5)',marginBottom:4,letterSpacing:'0.08em'}}>{pl.n}</div>
              <div style={{fontSize:24,fontWeight:600,color:T,lineHeight:1,marginBottom:2}}>{pl.p}</div>
              <div style={{fontSize:9,color:'rgba(32,178,170,0.25)',marginBottom:12,fontWeight:300}}>{pl.per}</div>
              <div style={{display:'flex',flexDirection:'column' as const,gap:5,marginBottom:14}}>
                {pl.features.map(f=><div key={f} style={{fontSize:10,color:'rgba(32,178,170,0.45)',display:'flex',gap:6,fontWeight:300}}><span style={{color:T}}>✓</span>{f}</div>)}
              </div>
              <button onClick={go} style={{width:'100%',padding:'7px',background:pl.pop?T:TD,border:pl.pop?'none':'1px solid rgba(32,178,170,0.15)',borderRadius:2,color:pl.pop?'#000':T,fontSize:9,fontWeight:pl.pop?600:400,cursor:'pointer',fontFamily:MN,letterSpacing:'0.06em'}}>{pl.cta}</button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{padding:'56px 24px',textAlign:'center' as const,position:'relative' as const}}>
        <div style={{position:'absolute' as const,inset:0,background:'radial-gradient(ellipse at center,rgba(32,178,170,0.05) 0%,transparent 60%)',pointerEvents:'none' as const}}/>
        <h2 style={{fontSize:'clamp(22px,4vw,36px)',fontWeight:600,color:'#fff',marginBottom:10,position:'relative' as const,letterSpacing:'-0.02em'}}>
          START PROTECTING YOUR<br/><span style={{color:T,fontWeight:500}}>SOLANA PORTFOLIO TODAY</span>
        </h2>
        <p style={{fontSize:10,color:'rgba(32,178,170,0.3)',marginBottom:22,letterSpacing:'0.08em',fontWeight:300,position:'relative' as const}}>10 FREE SCANS · NO CREDIT CARD REQUIRED</p>
        <button onClick={go} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 28px',background:T,color:'#000',border:'none',borderRadius:4,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:MN,letterSpacing:'0.06em',boxShadow:'0 0 28px rgba(32,178,170,0.25)',position:'relative' as const}}>LAUNCH APP FREE</button>
      </section>

      {/* FOOTER */}
      <footer style={{borderTop:'1px solid rgba(32,178,170,0.07)',padding:'16px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap' as const,gap:10,background:'#050505'}}>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <img src="/logo.jpg" alt="logo" style={{width:16,height:16,borderRadius:3,objectFit:'cover' as const}}/>
          <span style={{fontSize:11,fontWeight:400,color:'#e2e8f0'}}>CryptoCheck AI</span>
          <span style={{fontSize:9,color:'rgba(32,178,170,0.2)',fontWeight:300}}>© 2026</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{width:4,height:4,borderRadius:'50%',background:T}}/>
          <span style={{fontSize:9,color:T,letterSpacing:'0.08em',fontWeight:400}}>LIVE · SOLANA MAINNET</span>
        </div>
        <div style={{display:'flex',gap:14}}>
          {(['PRIVACY','TERMS','DOCS','CONTACT'] as string[]).map(l=>(
            <a key={l} href="#" style={{fontSize:9,color:'rgba(32,178,170,0.25)',letterSpacing:'0.06em',fontWeight:300,textDecoration:'none'}}>{l}</a>
          ))}
        </div>
      </footer>

      {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} onSuccess={(u:any)=>{setUser(u);window.location.replace('/app')}}/>}
    </div>
  )
}