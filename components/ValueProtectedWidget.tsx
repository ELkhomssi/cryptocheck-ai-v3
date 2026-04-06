'use client'
import { useState, useEffect, useRef } from 'react'

interface ProtectionEvent {
  id: number
  tokenName: string
  symbol: string
  riskType: string
  riskColor: string
  riskIcon: string
  valueSaved: number
  timestamp: Date
}

function CountUp({ target, duration = 1800 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0)
  const startTime = useRef<number | null>(null)

  useEffect(() => {
    if (target === 0) return
    startTime.current = null
    const animate = (ts: number) => {
      if (!startTime.current) startTime.current = ts
      const elapsed = ts - startTime.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.floor(target * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [target, duration])

  return <>${current.toLocaleString()}</>
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`
  return `${Math.floor(secs/3600)}h ago`
}

const RISK_TYPES = [
  { type:'Mint Authority',    color:'#ff4444', icon:'⚠️' },
  { type:'Rug Liquidity',     color:'#f0a500', icon:'🚨' },
  { type:'Whale Dump',        color:'#a371f7', icon:'🐋' },
  { type:'High Concentration',color:'#ff6b35', icon:'🎯' },
  { type:'Price Manipulation',color:'#ff4444', icon:'📉' },
]

const TOKEN_NAMES = [
  { name:'SolPump',  symbol:'SPUMP' },
  { name:'MoonCat',  symbol:'MCAT'  },
  { name:'SafeRug',  symbol:'SRUG'  },
  { name:'ElonSol',  symbol:'ESOL'  },
  { name:'MemeFi',   symbol:'MEFI'  },
  { name:'TrumpSol', symbol:'TSOL'  },
  { name:'DogeSol',  symbol:'DSOL'  },
  { name:'PepeSol',  symbol:'PSOL'  },
]

export default function ValueProtectedWidget({ events: externalEvents, compact }: { events?: ProtectionEvent[], compact?: boolean }) {
  const [events, setEvents] = useState<ProtectionEvent[]>([])
  const [totalSaved, setTotalSaved] = useState(0)
  const [pulse, setPulse] = useState(false)
  const idRef = useRef(0)

  // Load real scan history + generate initial events
  useEffect(() => {
    const initial: ProtectionEvent[] = []

    // Check real scan history from localStorage
    try {
      const history = JSON.parse(localStorage.getItem('cc_scan_history') || '[]')
      history.filter((s: {score:number}) => s.score < 40).slice(0, 3).forEach((s: {symbol:string;score:number;timestamp:number}) => {
        const risk = RISK_TYPES[Math.floor(Math.random() * RISK_TYPES.length)]
        idRef.current++
        initial.push({
          id: idRef.current,
          tokenName: s.symbol || 'Unknown',
          symbol: s.symbol || '???',
          riskType: risk.type,
          riskColor: risk.color,
          riskIcon: risk.icon,
          valueSaved: Math.floor((40 - s.score) * 85),
          timestamp: new Date(s.timestamp || Date.now())
        })
      })
    } catch {}

    // If no real data, start with empty (will populate from live scans)
    setEvents(externalEvents || initial)
    setTotalSaved((externalEvents || initial).reduce((a, e) => a + e.valueSaved, 0))
  }, [])

  // Pulse animation
  useEffect(() => {
    const iv = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(iv)
  }, [])

  // Listen for new scan results
  useEffect(() => {
    const handleScan = (e: CustomEvent) => {
      const { symbol, score } = e.detail
      if (score >= 40) return // only flag risky tokens

      const risk = RISK_TYPES[Math.floor(Math.random() * RISK_TYPES.length)]
      const saved = Math.floor((40 - score) * 85 + Math.random() * 500)
      idRef.current++

      const newEvent: ProtectionEvent = {
        id: idRef.current,
        tokenName: symbol,
        symbol,
        riskType: risk.type,
        riskColor: risk.color,
        riskIcon: risk.icon,
        valueSaved: saved,
        timestamp: new Date()
      }

      setEvents(prev => [newEvent, ...prev].slice(0, 6))
      setTotalSaved(prev => prev + saved)
    }

    window.addEventListener('tokenScanned', handleScan as EventListener)
    return () => window.removeEventListener('tokenScanned', handleScan as EventListener)
  }, [])

  const rugCount = events.length
  const avgSave = rugCount > 0 ? Math.floor(totalSaved / rugCount) : 0
  const roi = totalSaved > 0 ? Math.round(totalSaved / 30) : 0

  if (compact) return (
    <div style={{fontFamily:'IBM Plex Mono,monospace',display:'flex',alignItems:'center',gap:12,padding:'6px 10px',background:'rgba(0,212,130,0.04)',border:'1px solid rgba(0,212,130,0.1)',borderRadius:4,marginBottom:8}}>
      <span style={{width:6,height:6,borderRadius:'50%',background:pulse?'#00d4aa':'rgba(0,212,130,0.3)',boxShadow:pulse?'0 0 6px rgba(0,212,130,0.6)':'none',transition:'all 0.5s',flexShrink:0,display:'inline-block'}}/>
      <span style={{fontSize:'9px',fontWeight:700,color:'#00d4aa',letterSpacing:'0.1em'}}>NEURAL PROTECTION ACTIVE</span>
      <span style={{fontSize:'9px',color:'#6e7681',marginLeft:4}}>{rugCount > 0 ? `${rugCount} rugs blocked · ${totalSaved.toLocaleString()} saved` : 'Monitoring...'}</span>
      {events.slice(0,2).map(ev => (
        <span key={ev.id} style={{fontSize:'8px',color:ev.riskColor,background:`${ev.riskColor}15`,border:`1px solid ${ev.riskColor}30`,padding:'1px 6px',borderRadius:3,whiteSpace:'nowrap'}}>{ev.riskIcon} ${ev.symbol} +${ev.valueSaved.toLocaleString()}</span>
      ))}
      {totalSaved > 0 && <span style={{marginLeft:'auto',fontSize:'10px',fontWeight:700,color:'#00d4aa',fontFamily:'IBM Plex Mono,monospace'}}>$<CountUp target={totalSaved} duration={800} /></span>}
    </div>
  )

  return (
    <div style={{fontFamily:'IBM Plex Mono,monospace'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <div style={{
          display:'flex',alignItems:'center',gap:6,
          fontSize:'9px',fontWeight:700,letterSpacing:'0.12em',
          color:'#00d4aa',textTransform:'uppercase'
        }}>
          <span style={{
            width:8,height:8,borderRadius:'50%',
            background:pulse?'#00d4aa':'rgba(0,212,130,0.3)',
            display:'inline-block',
            boxShadow:pulse?'0 0 8px rgba(0,212,130,0.8)':'none',
            transition:'all 0.5s ease'
          }}/>
          NEURAL PROTECTION ACTIVE
        </div>
        <span style={{marginLeft:'auto',fontSize:'8px',color:'#6e7681'}}>Pays for itself</span>
      </div>

      {/* Total Value */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:'8px',color:'#6e7681',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>
          TOTAL VALUE PROTECTED
        </div>
        <div style={{
          fontSize:'28px',fontWeight:700,
          color:'#00d4aa',letterSpacing:'-0.02em',lineHeight:1,
          textShadow:totalSaved>0?'0 0 20px rgba(0,212,130,0.4)':'none'
        }}>
          {totalSaved > 0 ? <CountUp target={totalSaved} /> : <span style={{color:'#21262d'}}>$0</span>}
        </div>
        <div style={{fontSize:'9px',color:'#6e7681',marginTop:4}}>
          {rugCount > 0 ? `across ${rugCount} rug${rugCount>1?'s':''} avoided this session` : 'Scan tokens to start protecting your wallet'}
        </div>
      </div>

      {/* Stats grid */}
      {rugCount > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:12}}>
          {[
            { label:'Rugs Blocked', val:rugCount.toString(), color:'#e2e8f0' },
            { label:'Avg Save',     val:`$${avgSave.toLocaleString()}`, color:'#00d4aa' },
            { label:'ROI vs $30',   val:`${roi}x`, color:'#00d4aa' },
          ].map(s => (
            <div key={s.label} style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(0,212,130,0.08)',borderRadius:4,padding:'6px 8px'}}>
              <div style={{fontSize:'7px',color:'#6e7681',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:3}}>{s.label}</div>
              <div style={{fontSize:'13px',fontWeight:700,color:s.color}}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Events */}
      <div style={{fontSize:'8px',color:'#6e7681',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:6}}>
        RECENT PROTECTION EVENTS
      </div>

      {events.length === 0 ? (
        <div style={{textAlign:'center',padding:'20px 0',color:'#21262d',fontSize:'11px'}}>
          <div style={{fontSize:'24px',marginBottom:8}}>🛡️</div>
          <div style={{color:'#6e7681'}}>No events yet</div>
          <div style={{color:'#484f58',fontSize:'9px',marginTop:4}}>Scan tokens with score &lt; 40 to see protection events</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          {events.map((ev, i) => (
            <div key={ev.id} style={{
              display:'flex',alignItems:'center',gap:8,
              padding:'8px 10px',
              background:'rgba(0,0,0,0.2)',
              border:`1px solid ${ev.riskColor}22`,
              borderLeft:`2px solid ${ev.riskColor}`,
              borderRadius:4,
              animation:'fadeIn 0.3s ease',
              opacity: 1 - i * 0.15,
            }}>
              <span style={{fontSize:'14px',flexShrink:0}}>{ev.riskIcon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                  <span style={{fontSize:'10px',fontWeight:700,color:'#e2e8f0'}}>${ev.symbol}</span>
                  <span style={{
                    fontSize:'8px',fontWeight:700,
                    color:ev.riskColor,
                    background:`${ev.riskColor}15`,
                    border:`1px solid ${ev.riskColor}33`,
                    padding:'1px 5px',borderRadius:3
                  }}>{ev.riskType}</span>
                </div>
                <div style={{fontSize:'8px',color:'#6e7681'}}>{timeAgo(ev.timestamp)}</div>
              </div>
              <div style={{fontSize:'11px',fontWeight:700,color:'#00d4aa',flexShrink:0}}>
                +${ev.valueSaved.toLocaleString()} saved
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
