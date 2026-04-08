'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AuthModal from '../../components/AuthModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TEAL = '#20b2aa'
const TEAL_DIM = 'rgba(32,178,170,0.08)'
const TEAL_BORDER = 'rgba(32,178,170,0.15)'
const MONO = "'JetBrains Mono',monospace"

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

  const launch = () => user ? window.location.replace('/app') : setShowAuth(true)

  return (
    <div style={{background:'#000',color:'#e2e8f0',fontFamily:MONO,overflowX:'hidden',fontWeight:300}}>

      {/* NAV */}
      <nav style={{position:'sticky',top:0,zIndex:100,height:48,background:'rgba(0,0,0,0.92)',borderBottom:`1px solid ${TEAL_BORDER}`,backdropFilter:'blur(20px)',display:'flex',alignItems:'center',padding:'0 28px',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <img src="/logo.jpg" alt="logo" style={{width:22,height:22,borderRadius:4,objectFit:'cover'}}/>
          <span style={{fontSize:13,fontWeight:500,color:'#fff',letterSpacing:'0.01em'}}>CryptoCheck<span style={{color:TEAL}}>AI</span></span>
        </div>
        <div style={{display:'flex',gap:0,marginLeft:14}}>
          {[['Features','#features'],['Pricing','#pricing'],['Docs','#']].map(([t,h]) => (
            <a key={t} href={h} style={{padding:'5px 12px',fontSize:11,color:'rgba(32,178,170,0.5)',letterSpacing:'0.04em',fontWeight:400,textDecoration:'none'}}>{t}</a>
          ))}
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={launch} style={{padding:'5px 12px',fontSize:11,color:'rgba(32,178,170,0.5)',background:'none',border:'none',cursor:'pointer',fontFamily:MONO,letterSpacing:'0.04em',fontWeight:400}}>
            {user ? 'Dashboard' : 'Sign In'}
          </button>
          <button onClick={launch} style={{padding:'6px 16px',background:TEAL,color:'#000',border:'none',borderRadius:4,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:MONO,letterSpacing:'0.06em'}}>
            LAUNCH APP
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{minHeight:'88vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 24px 40px',textAlign:'center',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'10%',left:'20%',width:320,height:320,background:'radial-gradient(circle,rgba(32,178,170,0.1) 0%,transparent 65%)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',top:'50%',right:'10%',width:200,height:200,background:'radial-gradient(circle,rgba(45,212,191,0.07) 0%,transparent 65%)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(32,178,170,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(32,178,170,0.025) 1px,transparent 1px)',backgroundSize:'56px 56px',pointerEvents:'none'}}/>

        <div style={{display:'inline-flex',alignItems:'center',gap:7,padding:'4px 12px',background:TEAL_DIM,border:`1px solid ${TEAL_BORDER}`,borderRadius:20,fontSize:9,color:TEAL,marginBottom:28,letterSpacing:'0.08em',fontWeight:400}}>
          <span style={{width:4,height:4,borderRadius:'50%',background:TEAL,display:'inline-block'}}/>
          LIVE ON SOLANA MAINNET
        </div>

        <h1 style={{fontSize:'clamp(32px,5.5vw,66px)',fontWeight:700,lineHeight:1.05,letterSpacing:'-0.02em',maxWidth:800,margin:'0 auto 18px',fontFamily:MONO}}>
          <span style={{color:'#fff',fontWeight:600}}>SCAN AND PROTECT</span><br/>
          <span style={{color:TEAL,fontWeight:700}}>SOLANA TOKENS</span><br/>
          <span style={{color:'#fff',fontWeight:600}}>AT LIGHTNING SPEED</span>
        </h1>

        <p style={{fontSize:12,color:'rgba(32,178,170,0.45)',maxWidth:480,margin:'0 auto 32px',lineHeight:1.8,fontWeight:300,letterSpacing:'0.02em'}}>
          Institutional-grade Neural AI · Rug Detection · Whale Tracking · Auto-Sniper<br/>
          Powered by Helius RPC · Solana Mainnet
        </p>

        <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap',marginBottom:44}}>
          <button onClick={launch} style={{padding:'12px 28px',background:TEAL,color:'#000',border:'none',borderRadius:4,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:MONO,letterSpacing:'0.06em',boxShadow:'0 0 28px rgba(32,178,170,0.3)'}}>
            LAUNCH APP FREE
          </button>
          <a href="#features" style={{padding:'12px 22px',background:TEAL_DIM,color:'rgba(32,178,170,0.7)',border:`1px solid ${TEAL_BORDER}`,borderRadius:4,fontSize:12,fontWeight:400,letterSpacing:'0.04em',textDecoration:'none'}}>
            DOCUMENTATION
          </a>
        </div>

        {/* Stats */}
        <div style={{display:'flex',gap:0,marginBottom:48,border:`1px solid ${TEAL_BORDER}`,borderRadius:4,overflow:'hidden'}}>
          {[['$4.2M+','PROTECTED'],['14,902','SCANNED'],['97%','ACCURACY'],['<200ms','RESPONSE']].map(([v,l]) => (
            <div key={l} style={{padding:'10px 22px',borderRight:`1px solid ${TEAL_BORDER}`,textAlign:'center'}}>
              <div style={{fontSize:18,fontWeight:600,color:TEAL,lineHeight:1}}>{v}</div>
              <div style={{fontSize:8,color:'rgba(32,178,170,0.3)',marginTop:3,letterSpacing:'0.1em',fontWeight:400}}>{l}</div>
            </div>
          ))}
        </div>

        {/* App preview */}
        <div style={{width:'100%',maxWidth:860,margin:'0 auto',background:'#080808',border:`1px solid rgba(32,178,170,0.12)`,borderRadius:6,overflow:'hidden',boxShadow:'0 0 60px rgba(32,178,170,0.07),0 40px 80px rgba(0,0,0,0.8)'}}>
          <div style={{height:2,background:'linear-gradient(90deg,transparent,#20b2aa,#2dd4bf,transparent)'}}/>
          <div style={{background:'#0a0a0a',borderBottom:'1px solid rgba(32,178,170,0.07)',padding:'0 12px',height:30,display:'flex',alignItems:'center',gap:8}}>
            <div style={{display:'flex',gap:4}}>
              {['#ff5f57','#ffbd2e','#28c840'].map(c => <div key={c} style={{width:8,height:8,borderRadius:'50%',background:c}}/>)}
            </div>
            <div style={{flex:1,display:'flex',justifyContent:'center'}}>
              <div style={{background:'#060606',border:'1px solid rgba(32,178,170,0.08)',borderRadius:2,padding:'2px 14px',fontSize:8,color:'rgba(32,178,170,0.3)',letterSpacing:'0.04em'}}>cryptocheckai.com/app</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:3,fontSize:8,color:TEAL,letterSpacing:'0.06em'}}>
              <span style={{width:3,height:3,borderRadius:'50%',background:TEAL}}/>LIVE
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'150px 1fr 170px',height:190,fontFamily:MONO}}>
            <div style={{borderRight:'1px solid rgba(32,178,170,0.06)',padding:8,display:'flex',flexDirection:'column',gap:4}}>
              <div style={{fontSize:7,color:'rgba(32,178,170,0.25)',letterSpacing:'0.1em',fontWeight:400,marginBottom:2}}>NEURAL SCAN</div>
              <div style={{background:'#060606',border:'1px solid rgba(32,178,170,0.08)',borderRadius:2,padding:'4px 6px',fontSize:7,color:'rgba(32,178,170,0.25)',fontWeight:300}}>Paste mint...</div>
              <div style={{background:TEAL,borderRadius:2,padding:4,textAlign:'center',fontSize:7,fontWeight:600,color:'#000',letterSpacing:'0.06em'}}>SCAN</div>
              <div style={{fontSize:7,color:'rgba(32,178,170,0.2)',letterSpacing:'0.08em',fontWeight:400,marginTop:4}}>TRENDING</div>
              {[['BONK','+6.8%','#20b2aa'],['WIF','-2.1%','#ef4444'],['POPCAT','+15%','#20b2aa']].map(([s,c,col]) => (
                <div key={s} style={{display:'flex',justifyContent:'space-between',padding:'2px 3px',borderRadius:2}}>
                  <span style={{fontSize:7,color:'#d4d4d4',fontWeight:400}}>{s}</span>
                  <span style={{fontSize:7,color:col,fontWeight:500}}>{c}</span>
                </div>
              ))}
            </div>
            <div style={{padding:8,display:'flex',flexDirection:'column',gap:5}}>
              <div style={{background:'rgba(32,178,170,0.03)',border:'1px solid rgba(32,178,170,0.07)',borderRadius:2,padding:'4px 8px',display:'flex',alignItems:'center',gap:7}}>
                <span style={{width:3,height:3,borderRadius:'50%',background:TEAL}}/>
                <span style={{fontSize:7,fontWeight:500,color:TEAL,letterSpacing:'0.08em'}}>NEURAL PROTECTION ACTIVE</span>
                <span style={{marginLeft:'auto',fontSize:13,fontWeight:600,color:TEAL}}>$4,450</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4,flex:1}}>
                {[
                  {l:'NEURAL SCORE',v:'78',sub:'LOW RISK',c:TEAL,locked:false},
                  {l:'AI PREDICT',v:'82%',sub:'PRO',c:'#f59e0b',locked:true},
                  {l:'RUG PROB',v:'12%',sub:'SAFE',c:TEAL,locked:false}
                ].map(item => (
                  <div key={item.l} style={{background:'#060606',border:`1px solid ${item.locked?'rgba(245,158,11,0.1)':'rgba(32,178,170,0.07)'}`,borderRadius:3,padding:6,textAlign:'center',position:'relative',overflow:'hidden'}}>
                    {item.locked && (
                      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
                        <span style={{fontSize:9}}>🔒</span>
                        <div style={{fontSize:6,color:'#f59e0b',fontWeight:500,letterSpacing:'0.06em'}}>PRO</div>
                      </div>
                    )}
                    <div style={{fontSize:6,color:'rgba(32,178,170,0.25)',marginBottom:2,letterSpacing:'0.08em',fontWeight:400}}>{item.l}</div>
                    <div style={{fontSize:19,fontWeight:600,color:item.c,lineHeight:1}}>{item.v}</div>
                    <div style={{fontSize:6,color:item.c,marginTop:1,fontWeight:400}}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{borderLeft:'1px solid rgba(32,178,170,0.06)',padding:8,display:'flex',flexDirection:'column',gap:4}}>
              <div style={{fontSize:7,color:'rgba(32,178,170,0.25)',letterSpacing:'0.08em',fontWeight:400,marginBottom:2}}>ALPHA FEED</div>
              {[
                {tag:'WHL',bc:'rgba(245,158,11,0.1)',tc:'#f59e0b',txt:'7xKP bought BONK 180 SOL'},
                {tag:'RUG',bc:'rgba(239,68,68,0.1)',tc:'#ef4444',txt:'MEW holder dump 45%'},
                {tag:'ALP',bc:'rgba(32,178,170,0.07)',tc:TEAL,txt:'POPCAT vol +340%'}
              ].map(f => (
                <div key={f.tag} style={{display:'flex',gap:4,fontSize:7,alignItems:'flex-start'}}>
                  <span style={{padding:'1px 3px',background:f.bc,color:f.tc,borderRadius:1,flexShrink:0,fontWeight:500}}>{f.tag}</span>
                  <span style={{color:'rgba(32,178,170,0.35)',lineHeight:1.4,fontWeight:300}}>{f.txt}</span>
                </div>
              ))}
              <div style={{marginTop:4,display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>
                <div style={{padding:4,background:TEAL,borderRadius:1,textAlign:'center',fontSize:7,fontWeight:600,color:'#000'}}>BUY</div>
                <div style={{padding:4,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.15)',borderRadius:1,textAlign:'center',fontSize:7,fontWeight:500,color:'#ef4444'}}>SELL</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div style={{background:'#080808',borderTop:'1px solid rgba(32,178,170,0.07)',borderBottom:'1px solid rgba(32,178,170,0.07)',height:24,overflow:'hidden',display:'flex',alignItems:'center'}}>
        <div style={{display:'flex',whiteSpace:'nowrap' as const,gap:0,animation:'ticker 22s linear infinite'}}>
          {['SOL $82.08 +3.19%','BONK +6.84%','WIF -2.1%','POPCAT +15.4%','JUP +3.2%','NEURAL ENGINE ONLINE',
            'SOL $82.08 +3.19%','BONK +6.84%','WIF -2.1%','POPCAT +15.4%','JUP +3.2%','NEURAL ENGINE ONLINE'].map((t,i) => (
            <span key={i} style={{fontSize:8,fontWeight:300,color:'rgba(32,178,170,0.3)',padding:'0 16px',borderRight:'1px solid rgba(32,178,170,0.06)',letterSpacing:'0.06em'}}>{t}</span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" style={{padding:'64px 24px',maxWidth:920px,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{fontSize:9,fontWeight:500,letterSpacing:'0.14em',color:TEAL,marginBottom:10}}>WHY CRYPTOCHECK AI</div>
          <h2 style={{fontSize:'clamp(22px,3.5vw,36px)',fontWeight:600,color:'#fff',letterSpacing:'-0.02em'}}>
            Professional tools for <span style={{color:TEAL,fontWeight:500}}>serious Solana traders</span>
          </h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',background:'rgba(32,178,170,0.06)',border:`1px solid rgba(32,178,170,0.08)`,borderRadius:4,overflow:'hidden'}}>
          {[
            {icon:'🧠',title:'Neural Scan V4',badge:'FREE',pro:false,desc:'AI risk scoring, mint authority checks, holder distribution in under 2s.'},
            {icon:'⚡',title:'AI Prediction',badge:'PRO',pro:true,desc:'5m-15m price predictions using whale accumulation patterns.'},
            {icon:'🐋',title:'Whale Intel',badge:'PRO',pro:true,desc:'Track smart money wallets in real-time before the pump.'},
            {icon:'🔐',title:'Rug Forensics',badge:'PRO',pro:true,desc:'Deep contract analysis and bundling detection.'},
            {icon:'🎯',title:'Auto-Sniper',badge:'PRO',pro:true,desc:'AI executes trades when high-probability setups appear.'},
            {icon:'📡',title:'Alpha Feed',badge:'PRO',pro:true,desc:'Real-time alerts for whale movements and new pool launches.'},
          ].map((f,i) => (
            <div key={f.title} style={{background:'#000',padding:'16px',borderRight:i%3!==2?'1px solid rgba(32,178,170,0.06)':'none',borderBottom:i<3?'1px solid rgba(32,178,170,0.06)':'none',transition:'background 0.15s'}}
              onMouseEnter={e=>(e.currentTarget.style.background='rgba(32,178,170,0.02)')}
              onMouseLeave={e=>(e.currentTarget.style.background='#000')}>
              <div style={{fontSize:16,marginBottom:6}}>{f.icon}</div>
              <div style={{fontSize:11,fontWeight:500,color:'#e2e8f0',marginBottom:3}}>{f.title}</div>
              <div style={{fontSize:7,padding:'1px 6px',borderRadius:2,background:f.pro?'rgba(245,158,11,0.06)':TEAL_DIM,color:f.pro?'#f59e0b':TEAL,border:`1px solid ${f.pro?'rgba(245,158,11,0.15)':TEAL_BORDER}`,display:'inline-block',marginBottom:7,letterSpacing:'0.08em',fontWeight:500}}>{f.badge}</div>
              <p style={{fontSize:10,color:'rgba(32,178,170,0.4)',lineHeight:1.7,fontWeight:300,margin:0}}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{padding:'56px 24px',maxWidth:720px,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:9,fontWeight:500,letterSpacing:'0.14em',color:TEAL,marginBottom:10}}>PRICING</div>
          <h2 style={{fontSize:'clamp(20px,3.5vw,32px)',fontWeight:600,color:'#fff',letterSpacing:'-0.02em'}}>Simple, transparent pricing</h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',background:'rgba(32,178,170,0.06)',border:`1px solid rgba(32,178,170,0.08)`,borderRadius:4,overflow:'hidden'}}>
          {[
            {name:'STARTER',price:'$5',period:'one-time',pop:false,features:['10 Neural Scans','Rug Detection','Valid 30 days'],cta:'GET STARTED'},
            {name:'PRO',price:'$30',period:'/month',pop:true,features:['Unlimited Credits','AI Predictions','Auto-Sniper Bot','Whale Tracking'],cta:'UPGRADE TO PRO'},
            {name:'WHALE',price:'FREE',period:'0.5% success fee',pop:false,features:['Everything in Pro','0.5% on profits only','VIP Telegram'],cta:'APPLY FOR WHALE'},
          ].map((pl,i) => (
            <div key={pl.name} style={{background:pl.pop?'#050505':'#000',padding:'18px',borderRight:i<2?'1px solid rgba(32,178,170,0.08)':'none',position:'relative',overflow:'hidden'}}>
              {pl.pop && <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,#20b2aa,transparent)'}}/>}
              {pl.pop && <div style={{fontSize:7,fontWeight:600,color:'#000',background:TEAL,padding:'1px 7px',borderRadius:2,display:'inline-block',marginBottom:6,letterSpacing:'0.08em'}}>MOST POPULAR</div>}
              <div style={{fontSize:9,fontWeight:500,color:'rgba(32,178,170,0.5)',marginBottom:4,letterSpacing:'0.08em'}}>{pl.name}</div>
              <div style={{fontSize:24,fontWeight:600,color:TEAL,lineHeight:1,marginBottom:2}}>{pl.price}</div>
              <div style={{fontSize:9,color:'rgba(32,178,170,0.25)',marginBottom:12,fontWeight:300}}>{pl.period}</div>
              <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:14}}>
                {pl.features.map(f => (
                  <div key={f} style={{fontSize:10,color:'rgba(32,178,170,0.45)',display:'flex',gap:6,fontWeight:300}}>
                    <span style={{color:TEAL,fontWeight:400}}>✓</span>{f}
                  </div>
                ))}
              </div>
              <button onClick={launch} style={{width:'100%',padding:'7px',background:pl.pop?TEAL:TEAL_DIM,border:pl.pop?'none':`1px solid ${TEAL_BORDER}`,borderRadius:2,color:pl.pop?'#000':TEAL,fontSize:9,fontWeight:pl.pop?600:400,cursor:'pointer',fontFamily:MONO,letterSpacing:'0.06em'}}>
                {pl.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{padding:'56px 24px',textAlign:'center',position:'relative'}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at center,rgba(32,178,170,0.05) 0%,transparent 60%)',pointerEvents:'none'}}/>
        <h2 style={{fontSize:'clamp(22px,4vw,36px)',fontWeight:600,color:'#fff',marginBottom:10,position:'relative',letterSpacing:'-0.02em'}}>
          START PROTECTING YOUR<br/><span style={{color:TEAL,fontWeight:500}}>SOLANA PORTFOLIO TODAY</span>
        </h2>
        <p style={{fontSize:10,color:'rgba(32,178,170,0.3)',marginBottom:22,letterSpacing:'0.08em',fontWeight:300,position:'relative'}}>
          10 FREE SCANS · NO CREDIT CARD REQUIRED
        </p>
        <button onClick={launch} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 28px',background:TEAL,color:'#000',border:'none',borderRadius:4,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:MONO,letterSpacing:'0.06em',boxShadow:'0 0 28px rgba(32,178,170,0.25)',position:'relative'}}>
          LAUNCH APP FREE
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{borderTop:'1px solid rgba(32,178,170,0.07)',padding:'16px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,background:'#050505'}}>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <img src="/logo.jpg" alt="logo" style={{width:16,height:16,borderRadius:3,objectFit:'cover'}}/>
          <span style={{fontSize:11,fontWeight:400,color:'#e2e8f0',letterSpacing:'0.02em'}}>CryptoCheck AI</span>
          <span style={{fontSize:9,color:'rgba(32,178,170,0.2)',fontWeight:300}}>© 2026</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{width:4,height:4,borderRadius:'50%',background:TEAL}}/>
          <span style={{fontSize:9,color:TEAL,letterSpacing:'0.08em',fontWeight:400}}>LIVE · SOLANA MAINNET</span>
        </div>
        <div style={{display:'flex',gap:14}}>
          {['PRIVACY','TERMS','DOCS','CONTACT'].map(l => (
            <a key={l} href="#" style={{fontSize:9,color:'rgba(32,178,170,0.25)',letterSpacing:'0.06em',fontWeight:300,textDecoration:'none'}}>{l}</a>
          ))}
        </div>
      </footer>

      {showAuth && <AuthModal onClose={()=>setShowAuth(false)} onSuccess={(u:any)=>{setUser(u);window.location.replace('/app')}}/>}
    </div>
  )
}
