'use client'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Shield, Brain, Network, Activity, Zap, AlertTriangle, Eye, Lock, TrendingUp, Wallet, Search, Clock, Crosshair } from 'lucide-react'
import { loadEncryptedKey } from '@/lib/crypto/client-key-store'

type Tier = 'free' | 'pro' | 'elite'

export type TokenExitIntelResponse = {
  mint: string
  symbol: string
  splMintAuthority: string | null
  splFreezeAuthority: string | null
  metadataUpdateAuthority: string | null
  isSplMintRenounced: boolean
  isSplFullyRenounced: boolean
  iei: number
  neuralScore: number
  acutePoolWindowEndMs: number | null
  pairCreatedAtMs: number | null
  top1Pct: number
  liquidityUsd: number
  pairAgeMin: number | null
  dexUrl: string
  scannedAt: string
}

interface ProMaxEliteProps {
  /** Legacy: Supabase `is_pro` — use with {@link hasPremiumAccess} for full gating. */
  isPro: boolean
  /** ENTERPRISE / elite / institutional — superset of Pro for Elite UI (no upgrade strip). */
  hasPremiumAccess?: boolean
  tier?: Tier
  onUpgrade: () => void
  /** Active scan mint — wires IEI / LP cliff / Neural Score to `/api/token-exit-intel` (Helius RPC). */
  mint?: string | null
}

const TC = {
  pro: { label:'PRO MAX DEEP',price:30,accent:'#d4af37',alt:'#FFD700',rgb:'212,175,55',sec:'#20b2aa',grad:'linear-gradient(135deg,#d4af37,#FFD700)',glow:'rgba(212,175,55,0.06)',glowS:'rgba(212,175,55,0.15)',badge:'✦ PRO MAX DEEP',gc:['#ff4444','#d4af37','#00ff88'],cf:'goldG',feats:['GNN Cluster Mapping','Heuristic Scoring (523K)','LP Exit Prediction','Unlimited Audits','0% Performance Fees'],rf:'drop-shadow(0 10px 30px rgba(212,175,55,0.15))',desc:'GNN cluster mapping, predictive rug analysis, unlimited forensic audits.',speed:'<0.2s',bg:'#050505' },
  elite: { label:'PRO MAX ELITE',price:40,accent:'#8b5cf6',alt:'#a78bfa',rgb:'139,92,246',sec:'#6366f1',grad:'linear-gradient(135deg,#8b5cf6,#6366f1)',glow:'rgba(139,92,246,0.06)',glowS:'rgba(139,92,246,0.15)',badge:'◆ PRO MAX ELITE',gc:['#ff4444','#8b5cf6','#a78bfa'],cf:'violetG',feats:['Everything in Deep','Priority Neural Node (0.1ms)','Elite Whale Alerts (>$1M)','Institutional PDF Reports','Dedicated Forensic Queue','Real-time Push Notifications'],rf:'drop-shadow(0 10px 40px rgba(139,92,246,0.25)) hue-rotate(260deg)',desc:'Priority neural nodes, institutional PDF reports, elite whale alerts. The command center.',speed:'<0.1s',bg:'#030308' },
} as const

function rc(tp:string,tier:Tier):string{const t=TC[tier==='elite'?'elite':'pro'];switch(tp){case 'accent':return t.accent;case 'secondary':return t.sec;case 'danger':return'#ff4444';case 'warn':return'#ff6b35';case 'safe':return'#00ff88';default:return t.accent}}

const mkLiq=()=>Array.from({length:24},(_,i)=>({time:`${i}:00`,depth:Math.floor(800+Math.random()*400+Math.sin(i/3)*200),volume:Math.floor(200+Math.random()*300)}))
const mkTx=()=>[{id:1,from:'7xKP…8gQw',to:'DeFi…9hWs',amount:'2,450 SOL',token:'BONK',time:'12s ago',type:'whale' as const,risk:'low' as const},{id:2,from:'4qS9…aBhL',to:'Raydi…Pool',amount:'890 SOL',token:'WIF',time:'34s ago',type:'lp' as const,risk:'med' as const},{id:3,from:'BotA…3kRf',to:'9xMn…7pKe',amount:'12,500 SOL',token:'POPCAT',time:'1m ago',type:'sniper' as const,risk:'high' as const},{id:4,from:'Smar…tW3x',to:'Jup…Swap',amount:'340 SOL',token:'JUP',time:'2m ago',type:'whale' as const,risk:'low' as const},{id:5,from:'DevW…xRug',to:'CEX…Dep',amount:'45,000 SOL',token:'SCAM',time:'3m ago',type:'rug' as const,risk:'critical' as const},{id:6,from:'2eoM…ZRp3',to:'Pool…Lock',amount:'1,200 SOL',token:'GRASS',time:'4m ago',type:'lp' as const,risk:'low' as const},{id:7,from:'Alph…Hunt',to:'MEW…Buy',amount:'670 SOL',token:'MEW',time:'5m ago',type:'whale' as const,risk:'med' as const},{id:8,from:'Clus…Node',to:'Sybil…Net',amount:'8,900 SOL',token:'FAKE',time:'6m ago',type:'rug' as const,risk:'critical' as const}]
const NN=[{id:'dev',x:50,y:50,label:'Dev',tp:'danger',sz:14},{id:'w1',x:20,y:25,label:'WalA',tp:'accent',sz:8},{id:'w2',x:80,y:20,label:'WalB',tp:'accent',sz:8},{id:'w3',x:15,y:70,label:'WalC',tp:'accent',sz:7},{id:'w4',x:85,y:75,label:'CEX',tp:'secondary',sz:10},{id:'w5',x:35,y:85,label:'Mixer',tp:'danger',sz:9},{id:'w6',x:70,y:40,label:'LP',tp:'secondary',sz:10},{id:'w7',x:30,y:40,label:'Syb1',tp:'warn',sz:6},{id:'w8',x:60,y:80,label:'Syb2',tp:'warn',sz:6}]
const NE=[['dev','w1'],['dev','w2'],['dev','w3'],['dev','w6'],['w1','w7'],['w2','w6'],['w3','w5'],['w5','w8'],['w6','w4'],['w7','w8'],['w8','w4'],['w1','w3']]
const LL=[{lv:'INFO',tp:'secondary',msg:'Neural Engine v4.0 initialized'},{lv:'SCAN',tp:'accent',msg:'Decompiling bytecode: 2,847 instructions'},{lv:'GNN',tp:'accent',msg:'Mapping 847 wallet nodes'},{lv:'WARNING',tp:'warn',msg:'142 wallets → single entity (Sybil: 94.2%)'},{lv:'RUG_ALERT',tp:'danger',msg:'⚠ EXIT LIQUIDITY — LP removal: 12 SOL/s'},{lv:'HEURISTIC',tp:'secondary',msg:'523,841 contracts evaluated'},{lv:'CLUSTER',tp:'accent',msg:'Dev linked to 3 rugged tokens'},{lv:'PREDICT',tp:'danger',msg:'RUG PROB: 98.4%'},{lv:'VERDICT',tp:'safe',msg:'█ HIGH RISK — DO NOT BUY'},{lv:'INFO',tp:'secondary',msg:'Next contract queued...'},{lv:'SCAN',tp:'secondary',msg:'Safe archetype (91.7%)'},{lv:'VERDICT',tp:'safe',msg:'█ LOW RISK — 82/100 SAFE'}]

function Gauge({score,size=140,tier}:{score:number;size?:number;tier:Tier}){const t=TC[tier==='elite'?'elite':'pro'],r=(size-20)/2,ci=Math.PI*r,off=ci-(score/100)*ci,col=score>=70?'#00ff88':score>=40?t.accent:'#ff4444',lb=score>=70?'LOW RISK':score>=40?'MODERATE':'HIGH RISK';return<div style={{position:'relative',width:size,height:size/2+30}}><svg width={size} height={size/2+10} viewBox={`0 0 ${size} ${size/2+10}`}><defs><linearGradient id={`gg${tier}`} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={t.gc[0]}/><stop offset="50%" stopColor={t.gc[1]}/><stop offset="100%" stopColor={t.gc[2]}/></linearGradient><filter id={`gf${tier}`}><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d={`M10 ${size/2}A${r} ${r} 0 0 1 ${size-10} ${size/2}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round"/><path d={`M10 ${size/2}A${r} ${r} 0 0 1 ${size-10} ${size/2}`} fill="none" stroke={`url(#gg${tier})`} strokeWidth="8" strokeLinecap="round" strokeDasharray={ci} strokeDashoffset={off} filter={`url(#gf${tier})`} style={{transition:'stroke-dashoffset 1.5s ease'}}/></svg><div style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',textAlign:'center'}}><div style={{fontSize:28,fontWeight:900,color:col,fontFamily:"'IBM Plex Mono',monospace",lineHeight:1}}>{score}</div><div style={{fontSize:8,fontWeight:700,letterSpacing:'0.12em',color:col,marginTop:2}}>{lb}</div></div></div>}

function NetG({tier}:{tier:Tier}){const t=TC[tier==='elite'?'elite':'pro'];const[p,sP]=useState(0);useEffect(()=>{const iv=setInterval(()=>sP(v=>(v+1)%NE.length),1500);return()=>clearInterval(iv)},[]);return<svg viewBox="0 0 100 100" style={{width:'100%',height:'100%'}}><defs><filter id="ng"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>{NE.map(([f,to],i)=>{const a=NN.find(n=>n.id===f)!,b=NN.find(n=>n.id===to)!;return<line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={i===p?t.accent:`rgba(${t.rgb},0.12)`} strokeWidth={i===p?0.8:0.3} style={{transition:'all 0.5s'}}/>})}{NN.map(n=>{const c=rc(n.tp,tier);return<g key={n.id} filter="url(#ng)"><circle cx={n.x} cy={n.y} r={n.sz/3} fill={c+'30'} stroke={c} strokeWidth="0.4"/><circle cx={n.x} cy={n.y} r={n.sz/6} fill={c}/><text x={n.x} y={n.y+n.sz/2+3} textAnchor="middle" fontSize="2.5" fill="#6e7681">{n.label}</text></g>})}</svg>}

function GC({children,span=4,cls='',tier}:{children:React.ReactNode;span?:number;cls?:string;tier:Tier}){const t=TC[tier==='elite'?'elite':'pro'];return<div className={cls} style={{gridColumn:`span ${span}`,background:`radial-gradient(ellipse at 50% 0%,rgba(${t.rgb},0.03) 0%,rgba(0,0,0,0.4) 70%)`,backdropFilter:'blur(12px)',border:`1px solid rgba(${t.rgb},0.06)`,borderRadius:10,padding:'clamp(12px,2vw,18px)',position:'relative',overflow:'hidden'}}>{children}</div>}

function CH({icon:I,title,badge,tier}:{icon:any;title:string;badge?:string;tier:Tier}){const t=TC[tier==='elite'?'elite':'pro'];return<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}><div style={{display:'flex',alignItems:'center',gap:8}}><I size={14} color={t.accent}/><span style={{fontSize:11,fontWeight:700,color:'#e2e8f0'}}>{title}</span></div>{badge&&<span style={{fontSize:7,fontWeight:700,color:t.accent,padding:'2px 6px',background:t.glow,border:`1px solid rgba(${t.rgb},0.15)`,borderRadius:3,letterSpacing:'0.08em'}}>{badge}</span>}</div>}

function FTab({data,tier}:{data:ReturnType<typeof mkTx>;tier:Tier}){const t=TC[tier==='elite'?'elite':'pro'];const[f,sF]=useState('');const fd=useMemo(()=>data.filter(r=>!f||r.token.toLowerCase().includes(f.toLowerCase())),[data,f]);const rcs:Record<string,string>={low:'#00ff88',med:t.accent,high:'#ff6b35',critical:'#ff4444'};const tcs:Record<string,string>={whale:t.sec,lp:t.accent,sniper:'#8b5cf6',rug:'#ff4444'};return<div><div style={{marginBottom:8,display:'flex',alignItems:'center',gap:8}}><Search size={12} color="#484f58"/><input value={f} onChange={e=>sF(e.target.value)} placeholder="Filter..." style={{flex:1,background:'rgba(255,255,255,0.03)',border:`1px solid rgba(${t.rgb},0.08)`,borderRadius:4,padding:'5px 8px',fontSize:10,color:'#c9d1d9',fontFamily:"'IBM Plex Mono',monospace",outline:'none'}}/></div><div style={{overflowX:'auto',overflowY:'auto',maxHeight:220}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:500,fontSize:10,fontFamily:"'IBM Plex Mono',monospace"}}><thead><tr style={{position:'sticky',top:0,background:'#0a0a0a',zIndex:1}}>{['Type','From','To','Amount','Token','Time','Risk'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',fontSize:8,fontWeight:700,color:'#484f58',letterSpacing:'0.1em',borderBottom:`1px solid rgba(${t.rgb},0.06)`,whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead><tbody>{fd.map((r,i)=><tr key={r.id} style={{borderBottom:'1px solid rgba(255,255,255,0.02)',animation:`fadeRow 0.3s ease ${i*0.05}s both`}}><td style={{padding:'6px 8px'}}><span style={{fontSize:8,fontWeight:700,color:tcs[r.type],padding:'1px 5px',borderRadius:3,background:tcs[r.type]+'12',letterSpacing:'0.06em'}}>{r.type.toUpperCase()}</span></td><td style={{padding:'6px 8px',color:'#8b949e'}}>{r.from}</td><td style={{padding:'6px 8px',color:'#8b949e'}}>{r.to}</td><td style={{padding:'6px 8px',color:'#e2e8f0',fontWeight:600}}>{r.amount}</td><td style={{padding:'6px 8px',color:t.accent,fontWeight:700}}>{r.token}</td><td style={{padding:'6px 8px',color:'#484f58'}}>{r.time}</td><td style={{padding:'6px 8px'}}><span style={{display:'inline-flex',alignItems:'center',gap:3}}><span style={{width:5,height:5,borderRadius:'50%',background:rcs[r.risk],boxShadow:`0 0 4px ${rcs[r.risk]}`,animation:r.risk==='critical'?'riskPulse 1s infinite':'none'}}/><span style={{fontSize:8,color:rcs[r.risk],fontWeight:600}}>{r.risk.toUpperCase()}</span></span></td></tr>)}</tbody></table></div></div>}

function FTerm({tier}:{tier:Tier}){const t=TC[tier==='elite'?'elite':'pro'];const[lines,sL]=useState<typeof LL>([]);const ref=useRef<HTMLDivElement>(null);const idx=useRef(0);useEffect(()=>{const sp=tier==='elite'?800:1100;const iv=setInterval(()=>{sL(p=>[...p.slice(-20),LL[idx.current%LL.length]]);idx.current++;ref.current?.scrollTo(0,ref.current.scrollHeight)},sp);return()=>clearInterval(iv)},[tier]);return<div ref={ref} style={{height:'100%',overflowY:'auto',padding:'8px 10px',fontFamily:"'IBM Plex Mono',monospace",fontSize:9,lineHeight:2,scrollbarWidth:'none'}}>{lines.map((l,i)=>{const c=rc(l.tp,tier);return<div key={i} style={{opacity:i===lines.length-1?1:0.55}}><span style={{color:'#252525',marginRight:6,fontSize:8}}>{new Date().toTimeString().slice(0,8)}</span><span style={{color:c,fontWeight:700,fontSize:7,padding:'0 4px',borderRadius:2,background:c+'11',marginRight:6,letterSpacing:'0.06em'}}>{l.lv}</span><span style={{color:l.lv==='VERDICT'||l.lv==='RUG_ALERT'?c:'#6e7681'}}>{l.msg}</span></div>})}<span style={{color:t.accent,animation:'blink 1s infinite'}}>█</span></div>}

function SM({icon:I,label,value,delta,color}:{icon:any;label:string;value:string;delta?:string;color:string}){return<div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:32,height:32,borderRadius:8,background:color+'10',border:`1px solid ${color}20`,display:'flex',alignItems:'center',justifyContent:'center'}}><I size={14} color={color}/></div><div><div style={{fontSize:8,color:'#484f58',letterSpacing:'0.1em',fontWeight:600}}>{label}</div><div style={{display:'flex',alignItems:'baseline',gap:4}}><span style={{fontSize:16,fontWeight:800,color:'#e2e8f0',fontFamily:"'IBM Plex Mono',monospace"}}>{value}</span>{delta&&<span style={{fontSize:9,color:delta.startsWith('-')?'#ff4444':'#00ff88',fontWeight:600}}>{delta}</span>}</div></div></div>}

function truncAddr(a: string | null | undefined, f = 6, b = 4): string {
  if (a == null || a === '') return 'none'
  if (a.length <= f + b + 1) return a
  return `${a.slice(0, f)}…${a.slice(-b)}`
}

function fmtUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  if (n > 0) return `$${n.toFixed(0)}`
  return '—'
}

/** SPL + DEX-backed exit surface (IEI + acute pool-age window from chain + DexScreener). */
function AsymmetricExitRadar({
  tier,
  intel,
  loading,
  error,
  hasMint,
}: {
  tier: Tier
  intel: TokenExitIntelResponse | null
  loading: boolean
  error: string
  hasMint: boolean
}) {
  const t = TC[tier === 'elite' ? 'elite' : 'pro']
  const [, bump] = useState(0)
  useEffect(() => {
    const id = setInterval(() => bump((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const iei = intel?.iei ?? null
  const endTarget = intel?.acutePoolWindowEndMs ?? null
  const left = endTarget != null ? Math.max(0, endTarget - Date.now()) : 0
  const hh = String(Math.floor(left / 3600000)).padStart(2, '0')
  const mm = String(Math.floor((left % 3600000) / 60000)).padStart(2, '0')
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')
  const hasCountdown = endTarget != null && left > 0

  const barCol =
    iei == null ? '#484f58' : iei <= 0 ? '#00ff88' : iei >= 75 ? '#ff4444' : iei >= 40 ? '#ff6b35' : '#00ff88'
  const ieiLabel =
    iei == null
      ? hasMint
        ? 'AWAITING DATA'
        : 'NO MINT'
      : iei <= 0
        ? intel?.splFreezeAuthority
          ? 'MINT RENOUNCED · FREEZE STILL LIVE'
          : 'CLEAR — SPL MINT INFLATION PATH OFF'
        : iei >= 75
          ? 'ELEVATED — EXIT ASYMMETRY'
          : iei >= 40
            ? 'MODERATE INSIDER SURFACE'
            : 'CONTROLLED'

  const stc = { critical: '#ff4444', warn: '#ff6b35', safe: '#00ff88' } as const

  const rows = useMemo(() => {
    if (!intel) {
      return [
        { k: 'SPL mint authority', v: '—', st: 'warn' as const },
        { k: 'SPL freeze authority', v: '—', st: 'warn' as const },
        { k: 'Metadata update', v: '—', st: 'warn' as const },
        { k: 'Pool / liquidity (DexScreener)', v: '—', st: 'warn' as const },
      ]
    }
    const mintRow =
      intel.isSplMintRenounced
        ? ({ k: 'SPL mint authority', v: 'Renounced — no new inflation', st: 'safe' as const } as const)
        : ({ k: 'SPL mint authority', v: `Active · ${truncAddr(intel.splMintAuthority)}`, st: 'critical' as const } as const)
    const freezeRow =
      intel.splFreezeAuthority == null
        ? ({ k: 'SPL freeze authority', v: 'None', st: 'safe' as const } as const)
        : ({ k: 'SPL freeze authority', v: `Set · ${truncAddr(intel.splFreezeAuthority)}`, st: 'critical' as const } as const)
    const metaRow =
      intel.metadataUpdateAuthority == null
        ? ({ k: 'Metadata update', v: 'None (immutable URI path)', st: 'safe' as const } as const)
        : ({ k: 'Metadata update', v: `Active · ${truncAddr(intel.metadataUpdateAuthority)}`, st: 'warn' as const } as const)
    const liqParts = [`Liq ${fmtUsd(intel.liquidityUsd)}`, intel.pairAgeMin != null ? `pair ${intel.pairAgeMin}m` : 'no pair age']
    if (intel.acutePoolWindowEndMs && Date.now() < intel.acutePoolWindowEndMs) {
      liqParts.push(`acute window ${hh}:${mm}:${ss}`)
    } else if (intel.pairCreatedAtMs) {
      liqParts.push('outside 72h acute window')
    } else {
      liqParts.push('no DEX pair timestamp')
    }
    const poolRow = { k: 'Pool / liquidity (DexScreener)', v: liqParts.join(' · '), st: 'warn' as const }
    return [mintRow, freezeRow, metaRow, poolRow]
  }, [intel, hh, mm, ss])

  return (
    <div>
      {!hasMint && (
        <div style={{ fontSize: 9, color: '#8b949e', marginBottom: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(${t.rgb},0.08)` }}>
          Scan a token in the main scanner (or open a chart mint) to load live SPL authorities, IEI, and pool-age window via Helius RPC.
        </div>
      )}
      {error && (
        <div style={{ fontSize: 9, color: '#ff6b35', marginBottom: 10 }}>{error}</div>
      )}
      {loading && (
        <div style={{ fontSize: 9, color: t.accent, marginBottom: 8 }}>Pulling mint account + DEX context…</div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', justifyContent: 'space-between', gap: 14, marginBottom: 14 }}>
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: 8, color: '#484f58', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 6 }}>INSIDER EXIT INDEX (IEI)</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: barCol, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1 }}>{iei == null ? '—' : iei}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: barCol, letterSpacing: '0.06em', maxWidth: 220 }}>{ieiLabel}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', marginTop: 8, overflow: 'hidden' }}>
            <div
              style={{
                width: `${iei == null ? 2 : Math.min(100, Math.max(0, iei))}%`,
                height: '100%',
                borderRadius: 3,
                background: `linear-gradient(90deg,${t.sec},${barCol})`,
                transition: 'width 0.8s ease',
              }}
            />
          </div>
        </div>
        <div style={{ flex: '1 1 220px', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
          <div
            style={{
              flex: 1,
              maxWidth: 300,
              padding: '10px 12px',
              borderRadius: 8,
              background: hasCountdown ? 'rgba(255,68,68,0.06)' : 'rgba(0,255,136,0.04)',
              border: hasCountdown ? '1px solid rgba(255,68,68,0.2)' : `1px solid rgba(${t.rgb},0.12)`,
            }}
          >
            <div style={{ fontSize: 8, color: hasCountdown ? '#ff4444' : '#6e7681', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
              {hasCountdown ? 'ACUTE POOL-AGE WINDOW (72H)' : 'LP CLIFF TIMER'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#e2e8f0', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.06em' }}>
              {hasCountdown ? `${hh}:${mm}:${ss}` : endTarget != null && left <= 0 ? 'CLOSED' : '—'}
            </div>
            <div style={{ fontSize: 8, color: '#6e7681', marginTop: 4, lineHeight: 1.4 }}>
              {hasCountdown
                ? 'Countdown to end of 72h surveillance window from first DEX pair timestamp (not on-chain LP lock proof).'
                : intel?.iei === 0 && !intel?.splFreezeAuthority
                  ? 'No SPL inflation clock — mint renounced. Pool-age timer is independent; monitor LP token movements.'
                  : intel?.iei === 0 && intel?.splFreezeAuthority
                    ? 'Mint renounced (IEI clear) but freeze authority can still block transfers — see row below.'
                    : intel?.pairCreatedAtMs == null
                      ? 'No DEX pair time — list on a DEX or paste a traded mint for pool-age context.'
                      : 'Outside 72h acute window from pair creation; authority/holder risk may still apply.'}
            </div>
          </div>
          <Crosshair size={28} color={t.accent} style={{ opacity: 0.35 }} />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map((r) => (
          <div
            key={r.k}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid rgba(${t.rgb},0.06)`,
            }}
          >
            <span style={{ fontSize: 9, color: '#8b949e', fontWeight: 600 }}>{r.k}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: stc[r.st], textAlign: 'right', maxWidth: '62%' }}>{r.v}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 7, color: '#484f58', lineHeight: 1.5 }}>
        IEI is computed from live SPL mint + freeze authorities (RPC), holder top-1 %, DEX liquidity, and listing age. Neural Score in the adjacent card uses the same threat bundle.
      </div>
    </div>
  )
}

export default function ProMaxEliteDashboard({
  isPro,
  hasPremiumAccess,
  tier = 'pro',
  onUpgrade,
  mint: mintProp,
}: ProMaxEliteProps) {
  const at = tier === 'elite' ? 'elite' : 'pro'
  const t = TC[at]
  const unlocked = isPro || !!hasPremiumAccess
  const [liq] = useState(mkLiq)
  const [txs] = useState(mkTx)
  const [score, setScore] = useState(73)
  const [exitIntel, setExitIntel] = useState<TokenExitIntelResponse | null>(null)
  const [exitLoading, setExitLoading] = useState(false)
  const [exitError, setExitError] = useState('')
  const [mt, sM] = useState(false)
  const mint = (mintProp ?? '').trim()

  useEffect(() => {
    if (!mint || mint.length < 32) {
      setExitIntel(null)
      setExitError('')
      setExitLoading(false)
      setScore(73)
      return
    }

    let cancelled = false
    ;(async () => {
      setExitLoading(true)
      setExitError('')
      try {
        const apiKey = await loadEncryptedKey()
        if (!apiKey) {
          if (!cancelled) {
            setExitError('Paste your Intelligence Terminal API key to load live exit intel.')
            setExitLoading(false)
          }
          return
        }
        const res = await fetch('/api/token-exit-intel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ mint }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg =
            typeof data?.message === 'string'
              ? data.message
              : typeof data?.error?.message === 'string'
                ? data.error.message
                : `HTTP ${res.status}`
          if (!cancelled) {
            setExitIntel(null)
            setExitError(msg)
          }
          return
        }
        if (!cancelled && data?.mint) {
          setExitIntel(data as TokenExitIntelResponse)
          setScore(typeof data.neuralScore === 'number' ? data.neuralScore : 73)
        }
      } catch {
        if (!cancelled) setExitError('Exit intel request failed.')
      } finally {
        if (!cancelled) setExitLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mint])

  const neuralCells = useMemo(() => {
    if (!exitIntel) {
      return [
        { l: 'Concentration', v: '—', c: '#484f58' },
        { l: 'LP (DEX)', v: '—', c: '#484f58' },
        { l: 'SPL mint', v: '—', c: '#484f58' },
        { l: 'SPL freeze', v: '—', c: '#484f58' },
      ]
    }
    const ie = exitIntel
    const conc = ie.top1Pct >= 45 ? '#ff4444' : ie.top1Pct >= 25 ? '#ff6b35' : t.sec
    const mintC = ie.isSplMintRenounced ? '#00ff88' : '#ff4444'
    const liqC = ie.liquidityUsd >= 150_000 ? '#00ff88' : ie.liquidityUsd >= 25_000 ? t.accent : '#ff6b35'
    const fzC = ie.splFreezeAuthority ? '#ff4444' : '#00ff88'
    return [
      { l: 'Concentration', v: `${ie.top1Pct.toFixed(1)}%`, c: conc },
      { l: 'LP (DEX)', v: fmtUsd(ie.liquidityUsd), c: liqC },
      { l: 'SPL mint', v: ie.isSplMintRenounced ? 'RENOUNCED' : 'ACTIVE', c: mintC },
      { l: 'SPL freeze', v: ie.splFreezeAuthority ? 'SET' : 'OFF', c: fzC },
    ]
  }, [exitIntel, t])

  useEffect(() => {
    sM(true)
  }, [])

  if (!mt) return null

  if (false && !unlocked) return ( // Always show full dashboard as preview
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',padding:'clamp(16px,4vw,40px)',textAlign:'center',position:'relative'}}>
      <div style={{position:'absolute',top:'40%',left:'50%',transform:'translate(-50%,-50%)',width:400,height:400,borderRadius:'50%',background:`radial-gradient(circle,rgba(${t.rgb},0.06) 0%,transparent 60%)`,filter:'blur(60px)',pointerEvents:'none'}}/>
      <div style={{position:'relative',zIndex:1}}>
        <img src="/images/robot-gold.png" alt={t.label} style={{width:'clamp(180px,30vw,300px)',height:'auto',margin:'0 auto 20px',display:'block',borderRadius:16,filter:t.rf}}/>
        <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 14px',borderRadius:16,background:t.glow,border:`1px solid rgba(${t.rgb},0.12)`,marginBottom:16}}><span style={{width:5,height:5,borderRadius:'50%',background:t.accent,boxShadow:`0 0 6px ${t.accent}`}}/><span style={{fontSize:9,color:t.accent,fontWeight:700,letterSpacing:'0.1em'}}>{t.badge}</span></div>
        <h2 style={{fontSize:'clamp(22px,4vw,30px)',fontWeight:800,color:'#fff',margin:'0 0 8px',fontFamily:"'IBM Plex Mono',monospace"}}>Deep Forensic <span style={{color:t.accent}}>Intelligence</span></h2>
        <p style={{fontSize:12,color:'#6e7681',maxWidth:400,margin:'0 auto 16px',lineHeight:1.7}}>{t.desc}</p>
        <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:20,textAlign:'left',maxWidth:320,margin:'0 auto 20px'}}>{t.feats.map(f=><div key={f} style={{display:'flex',alignItems:'center',gap:6,fontSize:10,color:'#8b949e'}}><span style={{color:t.accent}}>✓</span> {f}</div>)}</div>
        <div style={{display:'inline-flex',alignItems:'center',gap:10,padding:'10px 20px',borderRadius:8,background:t.glow,border:`1px solid rgba(${t.rgb},0.12)`,marginBottom:20}}><span style={{fontSize:26,fontWeight:900,color:t.accent}}>${t.price}</span><div style={{textAlign:'left'}}><div style={{fontSize:10,color:t.accent,fontWeight:700}}>/month</div><div style={{fontSize:8,color:'#484f58'}}>UNLIMITED · 0% FEES</div></div></div>
        <div><button onClick={onUpgrade} style={{padding:'14px 32px',fontSize:13,fontWeight:700,background:t.grad,border:'none',borderRadius:8,color:'#000',cursor:'pointer',fontFamily:"'IBM Plex Mono',monospace",boxShadow:`0 0 30px ${t.glowS}`,letterSpacing:'0.03em'}}>Upgrade to {at==='elite'?'Elite':'Pro Max'}</button></div>
      </div>
    </div>
  )

  return(
    <div style={{padding:'clamp(8px,2vw,16px)',fontFamily:"'IBM Plex Mono','JetBrains Mono',monospace"}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}><Brain size={16} color={t.accent}/><span style={{fontSize:13,fontWeight:700,color:'#fff'}}>{t.label}</span><span style={{fontSize:7,fontWeight:700,color:t.accent,padding:'2px 6px',background:t.glow,border:`1px solid rgba(${t.rgb},0.15)`,borderRadius:3,animation:'riskPulse 2s infinite'}}>● LIVE</span></div>
        {!unlocked && (
          <div
            style={{
              width: '100%',
              padding: '8px 14px',
              background: 'rgba(139,92,246,0.06)',
              border: '1px solid rgba(139,92,246,0.15)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 10, color: '#8b949e' }}>
              ◆ Elite Preview —{' '}
              <span style={{ color: '#8b5cf6', fontWeight: 700 }}>Upgrade to unlock live data</span>
            </span>
            <button
              onClick={onUpgrade}
              style={{
                padding: '5px 14px',
                fontSize: 10,
                fontWeight: 700,
                background: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
                border: 'none',
                borderRadius: 4,
                color: '#fff',
                cursor: 'pointer',
                fontFamily: "'IBM Plex Mono',monospace",
              }}
            >
              Upgrade $40/mo
            </button>
          </div>
        )}
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><SM icon={Shield} label="AUDITS TODAY" value="47" delta="+12%" color={t.accent}/><SM icon={AlertTriangle} label="RUGS DETECTED" value="3" color="#ff4444"/></div>
      </div>
      <div className="pm-grid" style={{display:'grid',gap:10}}>
        <GC span={12} cls="pm-12" tier={at}>
          <CH icon={Clock} title="Asymmetric Exit Surface" badge={at === 'elite' ? 'ELITE · RPC' : 'DEEP · RPC'} tier={at} />
          <AsymmetricExitRadar
            tier={at}
            intel={exitIntel}
            loading={exitLoading}
            error={exitError}
            hasMint={mint.length >= 32}
          />
        </GC>
        <GC span={4} cls="pm-4" tier={at}>
          <CH icon={Brain} title="Neural Score" badge={exitIntel ? 'RPC+DEX' : 'DEMO'} tier={at} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Gauge score={score} size={140} tier={at} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', marginTop: 12 }}>
              {neuralCells.map((s) => (
                <div key={s.l} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ fontSize: 7, color: '#484f58', letterSpacing: '0.08em' }}>{s.l}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </GC>
        <GC span={8} cls="pm-8" tier={at}><CH icon={TrendingUp} title="Liquidity Depth" badge="24H" tier={at}/><div style={{height:200}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={liq}><defs><linearGradient id="goldG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d4af37" stopOpacity={0.3}/><stop offset="100%" stopColor="#d4af37" stopOpacity={0}/></linearGradient><linearGradient id="violetG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3}/><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient><filter id="cG"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><XAxis dataKey="time" tick={{fontSize:8,fill:'#484f58'}} axisLine={{stroke:'rgba(255,255,255,0.04)'}} tickLine={false} interval={3}/><YAxis tick={{fontSize:8,fill:'#484f58'}} axisLine={false} tickLine={false} width={35}/><Tooltip contentStyle={{background:'#0a0a0a',border:`1px solid rgba(${t.rgb},0.15)`,borderRadius:6,fontSize:10,fontFamily:"'IBM Plex Mono',monospace"}} labelStyle={{color:'#6e7681'}} itemStyle={{color:t.accent}}/><Area type="monotone" dataKey="depth" stroke={t.accent} strokeWidth={2} fill={`url(#${t.cf})`} filter="url(#cG)"/><Area type="monotone" dataKey="volume" stroke={t.sec} strokeWidth={1} fill={t.sec+'08'} strokeDasharray="4 2"/></AreaChart></ResponsiveContainer></div></GC>
        <GC span={6} cls="pm-6" tier={at}><CH icon={Network} title="Cluster Map" badge="GNN" tier={at}/><div style={{height:200}}><NetG tier={at}/></div><div style={{display:'flex',gap:12,marginTop:8,flexWrap:'wrap'}}>{[{l:'Nodes',v:'847',c:t.accent},{l:'Clusters',v:'12',c:'#ff4444'},{l:'Sybil',v:'142',c:'#ff6b35'}].map(s=><div key={s.l} style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:4,height:4,borderRadius:'50%',background:s.c}}/><span style={{fontSize:8,color:'#484f58'}}>{s.l}:</span><span style={{fontSize:9,fontWeight:700,color:s.c}}>{s.v}</span></div>)}</div></GC>
        <GC span={6} cls="pm-6" tier={at}><CH icon={Activity} title="Engine Metrics" badge="v4.0" tier={at}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>{[{icon:Zap,l:'SCAN SPEED',v:t.speed,c:t.sec},{icon:Eye,l:'CONTRACTS',v:'523K',c:t.accent},{icon:Lock,l:'LP LOCKED',v:'78%',c:'#ff6b35'},{icon:Wallet,l:'WALLETS',v:'847',c:t.accent}].map(s=><div key={s.l} style={{background:'rgba(255,255,255,0.02)',borderRadius:6,padding:10,display:'flex',alignItems:'center',gap:8}}><s.icon size={14} color={s.c}/><div><div style={{fontSize:7,color:'#484f58',letterSpacing:'0.08em'}}>{s.l}</div><div style={{fontSize:14,fontWeight:800,color:s.c}}>{s.v}</div></div></div>)}</div></GC>
        <GC span={8} cls="pm-8" tier={at}><CH icon={Activity} title="Live Forensic Transfers" badge="REAL-TIME" tier={at}/><FTab data={txs} tier={at}/></GC>
        <GC span={4} cls="pm-4" tier={at}><CH icon={Zap} title="Forensic Log" badge="STREAMING" tier={at}/><div style={{height:220,background:'#050505',borderRadius:6,border:`1px solid rgba(${t.rgb},0.06)`,overflow:'hidden'}}><FTerm tier={at}/></div></GC>
      </div>
      <style>{`@keyframes fadeRow{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@keyframes riskPulse{0%,100%{opacity:1}50%{opacity:0.3}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}.pm-grid{grid-template-columns:repeat(12,1fr)}@media(max-width:900px){.pm-grid{grid-template-columns:1fr!important}.pm-4,.pm-6,.pm-8,.pm-12{grid-column:span 1!important}}@media(min-width:901px)and(max-width:1200px){.pm-grid{grid-template-columns:repeat(6,1fr)!important}.pm-12{grid-column:span 6!important}.pm-4{grid-column:span 3!important}.pm-6{grid-column:span 3!important}.pm-8{grid-column:span 6!important}}`}</style>
    </div>
  )
}
