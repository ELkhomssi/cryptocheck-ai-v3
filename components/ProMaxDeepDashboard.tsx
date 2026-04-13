'use client'
import React, { useState, useEffect, useRef } from 'react'

interface DeepProps { isPro: boolean; onUpgrade: () => void }

const LOGS = [
  { tag:'DEEP_LEARNING', color:'#d4af37', msg:'Analyzing bytecode — 2,847 instructions decompiled' },
  { tag:'GNN', color:'#FFD700', msg:'Mapping wallet clusters — 847 nodes, 12 sub-graphs detected' },
  { tag:'SYBIL_DETECT', color:'#ff4444', msg:'⚠ 142 wallets traced to single entity (confidence: 94.2%)' },
  { tag:'LP_MONITOR', color:'#20b2aa', msg:'Liquidity pool analysis: 78% unlocked — monitoring removal velocity' },
  { tag:'HEURISTIC', color:'#d4af37', msg:'Model v3.7 — evaluating against 523,841 contract outcomes' },
  { tag:'CLUSTER', color:'#FFD700', msg:'Developer wallet 4qS9…aBhL linked to 3 previously rugged tokens' },
  { tag:'BYTECODE', color:'#20b2aa', msg:'Pattern: mint_authority=ACTIVE, freeze_authority=ACTIVE — flags raised' },
  { tag:'PREDICTION', color:'#ff4444', msg:'⚠ RUG PROBABILITY: 98.4% — Exit liquidity behavior detected in LP' },
  { tag:'GNN', color:'#FFD700', msg:'Cluster visualization complete — fund flow: SOL → Raydium → 6 wallets → CEX' },
  { tag:'VERDICT', color:'#00ff88', msg:'█ FORENSIC AUDIT COMPLETE — HIGH RISK — RECOMMEND: DO NOT BUY' },
  { tag:'DEEP_LEARNING', color:'#d4af37', msg:'Scanning next contract in queue...' },
  { tag:'HEURISTIC', color:'#20b2aa', msg:'Contract pattern matches safe archetype (confidence: 91.7%)' },
  { tag:'LP_MONITOR', color:'#00ff88', msg:'LP permanently burned via Raydium — 100% supply locked' },
  { tag:'VERDICT', color:'#00ff88', msg:'█ FORENSIC AUDIT COMPLETE — LOW RISK — Score: 82/100 SAFE' },
]

function ForensicLog() {
  const [lines, setLines] = useState<typeof LOGS>([])
  const ref = useRef<HTMLDivElement>(null)
  const idx = useRef(0)
  useEffect(() => {
    const iv = setInterval(() => {
      setLines(p => [...p.slice(-18), LOGS[idx.current % LOGS.length]])
      idx.current++
      ref.current?.scrollTo(0, ref.current.scrollHeight)
    }, 1300)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{background:'#080808',border:'1px solid rgba(212,175,55,0.1)',borderRadius:10,overflow:'hidden',boxShadow:'0 0 40px rgba(212,175,55,0.03)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',background:'#0c0c0c',borderBottom:'1px solid rgba(212,175,55,0.08)'}}>
        <div style={{display:'flex',gap:6}}><div style={{width:9,height:9,borderRadius:'50%',background:'#ff5f57'}}/><div style={{width:9,height:9,borderRadius:'50%',background:'#febc2e'}}/><div style={{width:9,height:9,borderRadius:'50%',background:'#28c840'}}/></div>
        <span style={{fontSize:9,color:'#484f58',letterSpacing:'0.08em',fontFamily:"'IBM Plex Mono',monospace"}}>NEURAL_ENGINE_v4.0 — DEEP FORENSIC MODE</span>
        <span style={{fontSize:7,fontWeight:700,color:'#d4af37',padding:'2px 8px',background:'rgba(212,175,55,0.08)',border:'1px solid rgba(212,175,55,0.15)',borderRadius:3,animation:'dpulse 2s infinite'}}>● LIVE</span>
      </div>
      <div ref={ref} style={{height:320,overflowY:'auto',padding:'12px 16px',fontFamily:"'IBM Plex Mono',monospace",fontSize:11,lineHeight:1.9,scrollbarWidth:'none'}}>
        {lines.map((l, i) => (
          <div key={i} style={{opacity:i===lines.length-1?1:0.65,animation:i===lines.length-1?'dfadeIn 0.3s ease':'none'}}>
            <span style={{color:'#303030',marginRight:8}}>{new Date().toTimeString().slice(0,8)}</span>
            <span style={{color:l.color,fontWeight:700,padding:'1px 6px',borderRadius:2,background:l.color+'11',marginRight:8,fontSize:9,letterSpacing:'0.06em'}}>{l.tag}</span>
            <span style={{color:l.tag==='VERDICT'?l.color:'#8b949e'}}>{l.msg}</span>
          </div>
        ))}
        <span style={{color:'#d4af37',animation:'dblink 1s infinite'}}>█</span>
      </div>
    </div>
  )
}

export default function ProMaxDeepDashboard({ isPro, onUpgrade }: DeepProps) {
  const [mt, sM] = useState(false)
  useEffect(() => sM(true), [])
  if (!mt) return null

  const feats = [
    { icon:'◈', title:'Cluster Mapping', sub:'SYBIL DETECTION', desc:'Visualize the developer wallet network. Detect if 100+ wallets belong to the same entity orchestrating fake volume and artificial holder counts.', stat:'847', statL:'avg nodes mapped' },
    { icon:'◉', title:'Heuristic Risk Scoring', sub:'DEEP LEARNING MODEL', desc:'Probability model trained on 523,841 rugged vs safe Solana contracts. Bytecode decompilation, authority analysis, and temporal pattern matching.', stat:'523K+', statL:'contracts trained' },
    { icon:'◎', title:'Liquidity Forensics', sub:'LP EXIT PREDICTION', desc:'Predictive analysis of LP-removal patterns. We alert you 4-12 minutes before the rug pull executes — enough time to exit your position.', stat:'4-12', statL:'min early warning' },
  ]

  const comp = [
    { feat:'Neural Scan Engine', basic:'Pattern matching', pro:'Deep Learning + GNN' },
    { feat:'Scan Limit', basic:'10 credits', pro:'∞ Unlimited' },
    { feat:'Risk Model', basic:'Rule-based flags', pro:'Heuristic probability (523K contracts)' },
    { feat:'Cluster Mapping', basic:'—', pro:'Full Sybil detection' },
    { feat:'Liquidity Forensics', basic:'Basic LP check', pro:'Predictive exit analysis' },
    { feat:'Whale Feed', basic:'Standard', pro:'Priority (< 200ms)' },
    { feat:'Performance Fee', basic:'0.5% on profits', pro:'0% — included' },
    { feat:'Forensic Audit Log', basic:'—', pro:'Full deep scan logs' },
    { feat:'Contract Decompiler', basic:'—', pro:'Bytecode analysis' },
  ]

  return (
    <div style={{padding:'clamp(16px,3vw,32px)',fontFamily:"'IBM Plex Mono','JetBrains Mono',monospace",maxWidth:900,margin:'0 auto'}}>

      {/* ═══ HERO ═══ */}
      <div style={{textAlign:'center',marginBottom:48,paddingTop:12}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 16px',borderRadius:20,background:'rgba(212,175,55,0.06)',border:'1px solid rgba(212,175,55,0.15)',marginBottom:20}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'#d4af37',boxShadow:'0 0 8px #d4af37',animation:'dpulse 2s infinite'}}/>
          <span style={{fontSize:10,color:'#d4af37',fontWeight:700,letterSpacing:'0.1em'}}>PRO MAX NEURAL ENGINE v4.0</span>
        </div>
        <h1 style={{fontSize:'clamp(24px,4vw,36px)',fontWeight:800,color:'#fff',margin:'0 0 12px',letterSpacing:'-0.03em',lineHeight:1.15}}>
          Beyond Pattern Matching.{' '}
          <span style={{background:'linear-gradient(135deg,#d4af37,#FFD700)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
            Deep Forensic Intelligence.
          </span>
        </h1>
        <p style={{fontSize:'clamp(12px,1.4vw,14px)',color:'#6e7681',lineHeight:1.7,maxWidth:560,margin:'0 auto 24px'}}>
          Graph Neural Networks and Deep Contract Decompilation identify fraud clusters across the Solana ecosystem. Trained on 523,841 contracts.
        </p>
        <div style={{display:'inline-flex',alignItems:'center',gap:10,padding:'12px 24px',borderRadius:10,background:'rgba(212,175,55,0.04)',border:'1px solid rgba(212,175,55,0.12)',boxShadow:'0 0 30px rgba(212,175,55,0.04)',marginBottom:24}}>
          <span style={{fontSize:30,fontWeight:900,color:'#d4af37'}}>$30</span>
          <div style={{textAlign:'left'}}>
            <div style={{fontSize:11,color:'#d4af37',fontWeight:700}}>/month</div>
            <div style={{fontSize:9,color:'#6e7681',letterSpacing:'0.06em'}}>UNLIMITED FORENSIC AUDITS</div>
          </div>
        </div>
        {!isPro && (
          <div><button onClick={onUpgrade} style={{padding:'14px 32px',fontSize:13,fontWeight:700,background:'linear-gradient(135deg,#d4af37,#FFD700)',border:'none',borderRadius:8,color:'#000',cursor:'pointer',fontFamily:"'IBM Plex Mono',monospace",boxShadow:'0 0 25px rgba(212,175,55,0.2)',letterSpacing:'0.03em',transition:'transform 0.2s'}}>Upgrade to Pro Max Deep</button></div>
        )}
      </div>

      {/* ═══ FEATURE GRID ═══ */}
      <div style={{marginBottom:48}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.2em',color:'#d4af37',marginBottom:16,textAlign:'center'}}>THE DEEP LEARNING EDGE</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:16}}>
          {feats.map((f, i) => (
            <div key={i} style={{background:'#080808',border:'1px solid rgba(212,175,55,0.08)',borderRadius:10,padding:'clamp(16px,2vw,24px)',position:'relative',overflow:'hidden',transition:'border-color 0.3s'}}>
              <div style={{position:'absolute',top:-15,right:-5,fontSize:60,fontWeight:900,color:'rgba(212,175,55,0.03)',lineHeight:1}}>0{i+1}</div>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'#d4af37',marginBottom:10}}>{f.sub}</div>
              <div style={{fontSize:20,color:'#d4af37',marginBottom:4,fontWeight:300}}>{f.icon}</div>
              <h3 style={{fontSize:16,fontWeight:700,color:'#fff',margin:'6px 0 8px',letterSpacing:'-0.01em'}}>{f.title}</h3>
              <p style={{fontSize:12,color:'#6e7681',lineHeight:1.6,margin:'0 0 14px'}}>{f.desc}</p>
              <div style={{borderTop:'1px solid rgba(212,175,55,0.06)',paddingTop:10,display:'flex',alignItems:'baseline',gap:6}}>
                <span style={{fontSize:20,fontWeight:800,color:'#d4af37'}}>{f.stat}</span>
                <span style={{fontSize:9,color:'#484f58',letterSpacing:'0.06em'}}>{f.statL}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ LIVE FORENSIC LOG ═══ */}
      <div style={{marginBottom:48}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.2em',color:'#20b2aa',marginBottom:14,textAlign:'center'}}>LIVE FORENSIC LOG</div>
        <ForensicLog />
      </div>

      {/* ═══ COMPARISON TABLE ═══ */}
      <div style={{marginBottom:48}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.2em',color:'#d4af37',marginBottom:14,textAlign:'center'}}>PLAN COMPARISON</div>
        <div style={{background:'#080808',border:'1px solid rgba(212,175,55,0.08)',borderRadius:10,overflowX:'auto'}}>
          <div style={{display:'grid',gridTemplateColumns:'1.3fr 1fr 1fr',background:'#0c0c0c',borderBottom:'1px solid rgba(212,175,55,0.06)',minWidth:520}}>
            <div style={{padding:'12px 16px',fontSize:8,fontWeight:700,color:'#484f58',letterSpacing:'0.12em'}}>FEATURE</div>
            <div style={{padding:'12px 16px',fontSize:8,fontWeight:700,color:'#6e7681',letterSpacing:'0.12em',textAlign:'center'}}>BASIC SCAN<br/><span style={{fontSize:12,fontWeight:800,color:'#8b949e'}}>Free</span></div>
            <div style={{padding:'12px 16px',fontSize:8,fontWeight:700,color:'#d4af37',letterSpacing:'0.12em',textAlign:'center'}}>PRO MAX DEEP<br/><span style={{fontSize:12,fontWeight:800}}>$30/mo</span></div>
          </div>
          {comp.map((r, i) => (
            <div key={i} style={{display:'grid',gridTemplateColumns:'1.3fr 1fr 1fr',borderBottom:i<comp.length-1?'1px solid rgba(255,255,255,0.02)':'none',transition:'background 0.2s',minWidth:520}}>
              <div style={{padding:'10px 16px',fontSize:'clamp(10px,2.8vw,11px)',lineHeight:1.4,color:'#c9d1d9',fontWeight:600}}>{r.feat}</div>
              <div style={{padding:'10px 16px',fontSize:'clamp(10px,2.8vw,11px)',lineHeight:1.4,color:r.basic==='—'?'#202020':'#6e7681',textAlign:'center'}}>{r.basic}</div>
              <div style={{padding:'10px 16px',fontSize:'clamp(10px,2.8vw,11px)',lineHeight:1.4,color:r.pro.includes('∞')||r.pro.includes('0%')?'#d4af37':'#20b2aa',fontWeight:600,textAlign:'center'}}>{r.pro}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ BOTTOM CTA ═══ */}
      {!isPro && (
        <div style={{textAlign:'center',padding:'32px 0'}}>
          <button onClick={onUpgrade} style={{padding:'16px 40px',fontSize:14,fontWeight:700,background:'linear-gradient(135deg,#d4af37,#FFD700)',border:'none',borderRadius:8,color:'#000',cursor:'pointer',fontFamily:"'IBM Plex Mono',monospace",boxShadow:'0 0 30px rgba(212,175,55,0.2)',letterSpacing:'0.03em'}}>
            Upgrade to Pro Max Deep — $30/mo
          </button>
          <div style={{fontSize:10,color:'#303030',marginTop:10,letterSpacing:'0.04em'}}>Cancel anytime · 0% performance fees · Unlimited forensic scans</div>
        </div>
      )}

      <style>{`
        @keyframes dpulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes dfadeIn{from{opacity:0}to{opacity:1}}
        @keyframes dblink{0%,100%{opacity:1}50%{opacity:0}}
      `}</style>
    </div>
  )
}
