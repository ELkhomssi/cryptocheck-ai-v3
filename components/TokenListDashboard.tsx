'use client'
import { useState, useEffect, useRef } from 'react'

const TOKENS = [
  { rank:1, sym:'SOL',    name:'Solana',       price:82.08,    change:3.19,  liq:'$56.8B', mcap:'$38.4B', trend:[60,62,58,65,70,68,74,72,78,82], mint:'So11111111111111111111111111111111111111112' },
  { rank:2, sym:'BONK',   name:'Bonk',         price:0.0000214,change:6.84,  liq:'$245M',  mcap:'$1.3B',  trend:[14,16,13,18,20,19,23,21,25,27], mint:'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { rank:3, sym:'POPCAT', name:'Popcat',        price:0.38,     change:15.4,  liq:'$95M',   mcap:'$380M',  trend:[20,22,24,28,26,32,35,38,42,46], mint:'7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdCBuHYmW2hr' },
  { rank:4, sym:'JUP',    name:'Jupiter',       price:0.82,     change:3.19,  liq:'$120M',  mcap:'$1.1B',  trend:[55,57,54,58,60,59,62,61,64,65], mint:'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { rank:5, sym:'WIF',    name:'dogwifhat',     price:1.24,     change:-2.1,  liq:'$180M',  mcap:'$1.2B',  trend:[80,78,75,77,73,72,70,71,68,65], mint:'EKpQGSml4jJeE3yJGk2bCRfFsGPNJMhTqHMLHJNK4p' },
  { rank:6, sym:'GRASS',  name:'Grass',         price:1.84,     change:10.6,  liq:'$78M',   mcap:'$920M',  trend:[30,32,35,38,42,45,50,52,55,60], mint:'Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs' },
  { rank:7, sym:'PYTH',   name:'Pyth Network',  price:0.28,     change:-3.3,  liq:'$85M',   mcap:'$420M',  trend:[50,48,45,46,43,44,40,38,37,35], mint:'HZ1JovNiVvGqNLQLjJe1yohSWhe58gorEHPHYNGrSWjk' },
  { rank:8, sym:'RAY',    name:'Raydium',       price:3.42,     change:2.41,  liq:'$65M',   mcap:'$980M',  trend:[42,43,41,44,46,45,48,47,50,52], mint:'4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
  { rank:9, sym:'FARTC',  name:'Fartcoin',      price:0.178,    change:7.79,  liq:'$48M',   mcap:'$178M',  trend:[18,20,19,22,25,24,28,30,32,35], mint:'9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump' },
  { rank:10,sym:'RENDER', name:'Render',        price:4.21,     change:5.11,  liq:'$55M',   mcap:'$1.6B',  trend:[60,62,61,65,68,67,70,72,74,76], mint:'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof' },
]

interface ScanResult {
  sym: string
  mint: string
  score: number
  verdict: string
  verdictColor: string
  confidence: number
  rugProb: number
  holders: number
  signals: Array<{label:string; val:string; ok:boolean}>
}

function Sparkline({ data, pos }: { data: number[], pos: boolean }) {
  const ref = useRef<SVGSVGElement>(null)
  const w = 64, h = 28
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const pts = data.map((v, i) => ({
    x: 2 + (i / (data.length - 1)) * (w - 4),
    y: h - 2 - ((v - min) / range) * (h - 4)
  }))
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const fill = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ` L${pts[pts.length-1].x},${h} L2,${h} Z`
  const col = pos ? '#34d399' : '#f87171'
  const last = pts[pts.length - 1]
  return (
    <svg ref={ref} width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{display:'block'}}>
      <defs>
        <linearGradient id={`sg${pos?'p':'n'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity={0.18}/>
          <stop offset="100%" stopColor={col} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg${pos?'p':'n'})`}/>
      <path d={path} fill="none" stroke={col} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={last.x} cy={last.y} r={2.5} fill={col}/>
    </svg>
  )
}

function RadialScore({ score }: { score: number }) {
  const col = score >= 70 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171'
  const r = 42, circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <svg width={110} height={110} viewBox="0 0 110 110">
      <circle cx={55} cy={55} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={7}/>
      <circle cx={55} cy={55} r={r} fill="none" stroke={col} strokeWidth={7}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 55 55)"
        style={{transition:'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      <text x={55} y={52} textAnchor="middle" fill={col} fontSize={22} fontWeight={700} fontFamily="JetBrains Mono,monospace">{score}</text>
      <text x={55} y={66} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="Inter,sans-serif">/100</text>
    </svg>
  )
}

export default function TokenListDashboard({ onScanToken, showModal }: { onScanToken?: (mint: string) => void, showModal?: () => void }) {
  const [filter, setFilter] = useState('trending')
  const [search, setSearch] = useState('')
  const [scanning, setScanning] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [activeRow, setActiveRow] = useState<string | null>(null)
  const [mintInput, setMintInput] = useState('')

  const filtered = TOKENS
    .filter(t => !search || t.sym.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => filter === 'gainers' ? b.change - a.change : filter === 'losers' ? a.change - b.change : a.rank - b.rank)

  function doScan(mint: string, sym: string) {
    if (scanning) return
    setScanning(sym)
    setActiveRow(sym)
    setResult(null)
    setTimeout(() => {
      const score = Math.floor(Math.random() * 55) + 30
      const isRug = score < 42
      const verdict = score >= 70 ? 'SAFE' : score >= 50 ? 'CAUTION' : 'HIGH RISK'
      const verdictColor = score >= 70 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171'
      setResult({
        sym, mint: mint.slice(0, 8) + '...' + mint.slice(-4),
        score, verdict, verdictColor,
        confidence: Math.floor(Math.random() * 20) + 70,
        rugProb: isRug ? Math.floor(Math.random() * 25) + 60 : Math.floor(Math.random() * 15) + 3,
        holders: Math.floor(Math.random() * 20) + 2,
        signals: [
          { label: 'Mint Authority', val: isRug ? 'Active' : 'Revoked', ok: !isRug },
          { label: 'Freeze Auth',    val: isRug ? 'Active' : 'Revoked', ok: !isRug },
          { label: 'LP Locked',      val: isRug ? 'No' : 'Yes',         ok: !isRug },
          { label: 'Top 10 Hold',    val: `${Math.floor(Math.random() * 40) + 8}%`, ok: score > 50 },
          { label: 'Pool Age',       val: `${Math.floor(Math.random() * 700) + 5}d`, ok: score > 50 },
        ]
      })
      setScanning(null)
      if (onScanToken) onScanToken(mint)
    }, 1800)
  }

  const COL = 'rgba(255,255,255,0.05)'
  const BG1 = 'rgba(255,255,255,0.02)'

  return (
    <div style={{background:'#000',color:'#f0fdf4',height:'100%',display:'flex',flexDirection:'column',fontFamily:'Inter,system-ui,sans-serif'}}>

      {/* Filter bar */}
      <div style={{padding:'8px 14px',borderBottom:`1px solid ${COL}`,display:'flex',alignItems:'center',gap:6,flexShrink:0,background:'rgba(255,255,255,0.01)'}}>
        <div style={{display:'flex',gap:3}}>
          {[['trending','Trending'],['gainers','Gainers'],['losers','Losers'],['new','New']].map(([f,l]) => (
            <button key={f} onClick={()=>setFilter(f)} style={{padding:'4px 11px',fontSize:9,fontWeight:600,background:filter===f?'#34d399':BG1,border:filter===f?'none':`1px solid ${COL}`,borderRadius:4,color:filter===f?'#000':'#6b7280',cursor:'pointer',fontFamily:'Inter,sans-serif',letterSpacing:'0.04em'}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
          <div style={{display:'flex',alignItems:'center',background:BG1,border:`1px solid ${COL}`,borderRadius:6,padding:'0 10px',height:28,gap:6}}>
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth={2}><circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tokens..." style={{background:'transparent',border:'none',color:'#f0fdf4',fontSize:11,outline:'none',fontFamily:'Inter,sans-serif',width:140}}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:4,fontSize:9,color:'#34d399',fontFamily:'JetBrains Mono,monospace'}}>
            <span style={{width:4,height:4,borderRadius:'50%',background:'#34d399',display:'inline-block',animation:'pulse 1.5s infinite'}}/>
            Helius RPC
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 290px',flex:1,minHeight:0,overflow:'hidden'}}>

        {/* Token list */}
        <div style={{display:'flex',flexDirection:'column',overflow:'hidden',borderRight:`1px solid ${COL}`}}>

          {/* Column headers */}
          <div style={{display:'grid',gridTemplateColumns:'28px 1.6fr 100px 70px 88px 88px 64px 84px',padding:'6px 14px',fontSize:9,fontWeight:500,color:'#4b5563',letterSpacing:'0.08em',textTransform:'uppercase',borderBottom:`1px solid ${COL}`,flexShrink:0}}>
            <span/><span>Token</span>
            <span style={{textAlign:'right'}}>Price</span>
            <span style={{textAlign:'right'}}>24h</span>
            <span style={{textAlign:'right'}}>Liquidity</span>
            <span style={{textAlign:'right'}}>MCap</span>
            <span style={{textAlign:'center'}}>Trend</span>
            <span style={{textAlign:'center'}}>Action</span>
          </div>

          {/* Rows */}
          <div style={{flex:1,overflowY:'auto'}}>
            {filtered.map((t, i) => {
              const pos = t.change >= 0
              const col = pos ? '#34d399' : '#f87171'
              const isActive = activeRow === t.sym
              const isScanning = scanning === t.sym
              return (
                <div key={t.sym} style={{display:'grid',gridTemplateColumns:'28px 1.6fr 100px 70px 88px 88px 64px 84px',padding:'9px 14px',borderBottom:`1px solid ${COL}`,alignItems:'center',background:isActive?'rgba(52,211,153,0.03)':'transparent',transition:'background 0.15s',animation:`fadeUp 0.2s ease ${i*0.03}s both`}}
                  onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                  onMouseLeave={e=>(e.currentTarget.style.background=isActive?'rgba(52,211,153,0.03)':'transparent')}>
                  <span style={{fontSize:9,color:'#374151',fontFamily:'JetBrains Mono,monospace'}}>{t.rank}</span>
                  <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                    <div style={{width:30,height:30,borderRadius:8,background:`${col}10`,border:`1px solid ${col}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:col,flexShrink:0,fontFamily:'JetBrains Mono,monospace'}}>{t.sym.slice(0,3)}</div>
                    <div style={{minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <span style={{fontSize:11,fontWeight:600,color:'#f0fdf4',letterSpacing:'-0.01em'}}>{t.sym}</span>
                        <span style={{fontSize:8,padding:'1px 6px',borderRadius:20,background:`${col}10`,color:col,border:`1px solid ${col}18`,fontWeight:600}}>{pos?'↑ Bullish':'↓ Bearish'}</span>
                      </div>
                      <div style={{fontSize:9,color:'#4b5563',marginTop:1}}>{t.name}</div>
                    </div>
                  </div>
                  <div style={{textAlign:'right',fontSize:10,color:'#f0fdf4',fontFamily:'JetBrains Mono,monospace',fontWeight:500}}>${t.price < 0.001 ? t.price.toFixed(7) : t.price < 1 ? t.price.toFixed(4) : t.price.toFixed(2)}</div>
                  <div style={{textAlign:'right',fontSize:10,fontWeight:600,color:col,fontFamily:'JetBrains Mono,monospace'}}>{pos?'+':''}{t.change}%</div>
                  <div style={{textAlign:'right',fontSize:10,color:'#9ca3af',fontFamily:'JetBrains Mono,monospace'}}>{t.liq}</div>
                  <div style={{textAlign:'right',fontSize:10,color:'#9ca3af',fontFamily:'JetBrains Mono,monospace'}}>{t.mcap}</div>
                  <div style={{display:'flex',justifyContent:'center'}}><Sparkline data={t.trend} pos={pos}/></div>
                  <div style={{display:'flex',justifyContent:'center'}}>
                    <button onClick={()=>doScan(t.mint, t.sym)} disabled={!!scanning} style={{padding:'4px 10px',background:isActive?'rgba(52,211,153,0.12)':'rgba(52,211,153,0.06)',border:`1px solid rgba(52,211,153,${isActive?0.3:0.15})`,borderRadius:5,color:'#34d399',fontSize:9,fontWeight:600,cursor:scanning?'not-allowed':'pointer',opacity:scanning&&!isScanning?0.4:1,fontFamily:'Inter,sans-serif',letterSpacing:'0.04em',transition:'all 0.15s'}}>
                      {isScanning ? '...' : 'Scan'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mint input */}
          <div style={{padding:'8px 12px',borderTop:`1px solid ${COL}`,background:'rgba(255,255,255,0.01)',display:'flex',gap:6,flexShrink:0}}>
            <div style={{flex:1,display:'flex',alignItems:'center',background:BG1,border:`1px solid ${COL}`,borderRadius:6,overflow:'hidden'}}>
              <span style={{padding:'0 10px',fontSize:10,color:'#34d399',fontFamily:'JetBrains Mono,monospace'}}>⚡</span>
              <input value={mintInput} onChange={e=>setMintInput(e.target.value)} placeholder="Paste Solana mint address..." style={{flex:1,background:'transparent',border:'none',padding:'8px 0',color:'#f0fdf4',fontSize:10,outline:'none',fontFamily:'JetBrains Mono,monospace'}}/>
            </div>
            <button onClick={()=>{ if(mintInput.length>20) doScan(mintInput,'???') }} style={{padding:'0 14px',background:'linear-gradient(135deg,#34d399,#059669)',border:'none',borderRadius:6,color:'#000',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',letterSpacing:'0.04em'}}>SCAN</button>
          </div>
        </div>

        {/* Forensics panel */}
        <div style={{display:'flex',flexDirection:'column',overflow:'hidden',background:'#000'}}>
          <div style={{padding:'10px 14px',borderBottom:`1px solid ${COL}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,background:'rgba(255,255,255,0.01)'}}>
            <div style={{fontSize:9,fontWeight:600,color:'#34d399',letterSpacing:'0.1em',fontFamily:'JetBrains Mono,monospace',display:'flex',alignItems:'center',gap:5}}>
              <span style={{width:4,height:4,borderRadius:'50%',background:'#34d399',display:'inline-block'}}/>
              FORENSICS
            </div>
            <div style={{fontSize:9,color: scanning?'#fbbf24':result?'#34d399':'#4b5563',fontFamily:'JetBrains Mono,monospace'}}>
              {scanning ? `Scanning ${scanning}...` : result ? `✓ ${result.sym} analyzed` : 'Idle'}
            </div>
          </div>

          <div style={{flex:1,overflowY:'auto'}}>
            {!scanning && !result && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:24,gap:10}}>
                <div style={{width:48,height:48,borderRadius:'50%',background:'rgba(52,211,153,0.04)',border:'1px solid rgba(52,211,153,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>⬡</div>
                <div style={{fontSize:13,fontWeight:500,color:'#f0fdf4',letterSpacing:'-0.01em'}}>Select a token</div>
                <div style={{fontSize:11,color:'#4b5563',textAlign:'center',lineHeight:1.7,maxWidth:200}}>Click Scan on any row to see instant AI analysis here</div>
                <div style={{display:'flex',flexDirection:'column',gap:4,width:'100%',marginTop:6}}>
                  {['AI Risk Score 0-100','Security Signals','Holder Distribution'].map(f => (
                    <div key={f} style={{padding:'6px 9px',background:'rgba(52,211,153,0.02)',border:'1px solid rgba(52,211,153,0.06)',borderRadius:5,fontSize:9,color:'#4b5563',display:'flex',alignItems:'center',gap:7}}>
                      <span style={{color:'#34d399'}}>✓</span> {f}
                    </div>
                  ))}
                  <div style={{padding:'6px 9px',background:'rgba(251,191,36,0.02)',border:'1px solid rgba(251,191,36,0.07)',borderRadius:5,fontSize:9,color:'#4b5563',display:'flex',alignItems:'center',gap:7}}>
                    <span style={{color:'#fbbf24'}}>🔒</span> AI Prediction · PRO
                  </div>
                </div>
              </div>
            )}

            {scanning && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:12,padding:24}}>
                <div style={{width:32,height:32,border:'2px solid #34d399',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
                <div style={{fontSize:11,color:'#34d399',fontFamily:'JetBrains Mono,monospace',letterSpacing:'0.06em'}}>ANALYZING...</div>
                <div style={{fontSize:9,color:'#4b5563',fontFamily:'JetBrains Mono,monospace'}}>Neural Engine v4</div>
              </div>
            )}

            {!scanning && result && (
              <div style={{animation:'fadeUp 0.3s ease'}}>
                {/* Token header */}
                <div style={{padding:'12px 14px',borderBottom:`1px solid ${COL}`,display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:34,height:34,borderRadius:8,background:`${result.verdictColor}10`,border:`1px solid ${result.verdictColor}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:result.verdictColor,fontFamily:'JetBrains Mono,monospace'}}>{result.sym.slice(0,3)}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:'#f0fdf4',letterSpacing:'-0.02em'}}>{result.sym}</div>
                    <div style={{fontSize:9,color:'#4b5563',fontFamily:'JetBrains Mono,monospace',marginTop:1}}>{result.mint}</div>
                  </div>
                  <div style={{marginLeft:'auto'}}>
                    <span style={{fontSize:9,padding:'3px 9px',borderRadius:20,background:`${result.verdictColor}10`,color:result.verdictColor,border:`1px solid ${result.verdictColor}20`,fontWeight:600}}>{result.verdict}</span>
                  </div>
                </div>

                {/* Radial score */}
                <div style={{padding:'14px',borderBottom:`1px solid ${COL}`,display:'flex',alignItems:'center',gap:12}}>
                  <RadialScore score={result.score}/>
                  <div style={{display:'flex',flexDirection:'column',gap:5,flex:1}}>
                    {[
                      {l:'Confidence',v:`${result.confidence}%`,c:'#34d399'},
                      {l:'Rug Prob',v:`${result.rugProb}%`,c:result.rugProb>50?'#f87171':'#34d399'},
                      {l:'Holders',v:`${result.holders}K`,c:'#f0fdf4'},
                    ].map(m => (
                      <div key={m.l} style={{padding:'5px 8px',background:BG1,border:`1px solid ${COL}`,borderRadius:5,display:'flex',justifyContent:'space-between',fontSize:9}}>
                        <span style={{color:'#4b5563'}}>{m.l}</span>
                        <span style={{color:m.c,fontFamily:'JetBrains Mono,monospace',fontWeight:600}}>{m.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signals */}
                <div style={{padding:'10px 14px',borderBottom:`1px solid ${COL}`}}>
                  <div style={{fontSize:8,fontWeight:600,letterSpacing:'0.1em',color:'#374151',textTransform:'uppercase',marginBottom:6,fontFamily:'JetBrains Mono,monospace'}}>Security Signals</div>
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    {result.signals.map(s => (
                      <div key={s.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 8px',background:s.ok?'rgba(52,211,153,0.02)':'rgba(248,113,113,0.03)',border:`1px solid ${s.ok?'rgba(52,211,153,0.07)':'rgba(248,113,113,0.1)'}`,borderRadius:5}}>
                        <span style={{fontSize:9,color:'#6b7280'}}>{s.label}</span>
                        <span style={{fontSize:8,padding:'1px 7px',borderRadius:20,background:s.ok?'rgba(52,211,153,0.08)':'rgba(248,113,113,0.08)',color:s.ok?'#34d399':'#f87171',border:`1px solid ${s.ok?'rgba(52,211,153,0.18)':'rgba(248,113,113,0.18)'}`,fontWeight:600}}>{s.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Prediction locked */}
                <div style={{padding:'10px 14px',borderBottom:`1px solid ${COL}`}}>
                  <div style={{background:'rgba(251,191,36,0.02)',border:'1px solid rgba(251,191,36,0.08)',borderRadius:7,padding:10,position:'relative',overflow:'hidden'}}>
                    <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(251,191,36,0.3),transparent)'}}/>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <span style={{fontSize:9,fontWeight:600,color:'#fbbf24',fontFamily:'JetBrains Mono,monospace',letterSpacing:'0.06em'}}>AI PREDICTION</span>
                      <span style={{fontSize:8,padding:'1px 6px',borderRadius:20,background:'rgba(251,191,36,0.1)',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.2)',fontWeight:600}}>PRO</span>
                    </div>
                    <div style={{fontSize:9,color:'#4b5563',marginBottom:7,lineHeight:1.5}}>5m-15m signal · auto-sniper · confidence score</div>
                    <button onClick={showModal} style={{width:'100%',padding:7,background:'linear-gradient(135deg,#fbbf24,#f59e0b)',border:'none',borderRadius:5,color:'#000',fontSize:9,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',letterSpacing:'0.04em'}}>Unlock Pro — $30/mo</button>
                  </div>
                </div>

                {/* Actions */}
                <div style={{padding:'10px 14px'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    <button style={{padding:8,background:'linear-gradient(135deg,#34d399,#059669)',border:'none',borderRadius:6,color:'#000',fontSize:9,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',letterSpacing:'0.04em'}}>📈 Chart</button>
                    <button style={{padding:8,background:BG1,border:`1px solid ${COL}`,borderRadius:6,color:'#34d399',fontSize:9,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>⚡ Jupiter</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}
