'use client'
import { useState, useEffect, useRef } from 'react'

const HELIUS_KEY = '35530e51-dad1-480b-af8f-11c8af2ab3fd'

interface Token {
  symbol: string
  name: string
  price: number
  change24h: number
  volume24h: number
  mint: string
  marketCap?: number
}

const SOLANA_TOKENS: Token[] = [
  { symbol:'SOL',    name:'Solana',          price:82.08,  change24h:3.19,  volume24h:56780000000, mint:'So11111111111111111111111111111111111111112' },
  { symbol:'BONK',   name:'Bonk',            price:0.0000214, change24h:6.84, volume24h:245000000, mint:'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol:'WIF',    name:'dogwifhat',       price:1.24,   change24h:5.76,  volume24h:180000000,  mint:'EKpQGSml4jJeE3yJGk2bCRfFsGPNJMhTqHMLHJNK4p' },
  { symbol:'JUP',    name:'Jupiter',         price:0.82,   change24h:3.19,  volume24h:120000000,  mint:'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { symbol:'PYTH',   name:'Pyth Network',    price:0.28,   change24h:4.95,  volume24h:85000000,   mint:'HZ1JovNiVvGqNLQLjJe1yohSWhe58gorEHPHYNGrSWjk' },
  { symbol:'RAY',    name:'Raydium',         price:3.42,   change24h:2.41,  volume24h:65000000,   mint:'4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
  { symbol:'POPCAT', name:'Popcat',          price:0.38,   change24h:8.07,  volume24h:95000000,   mint:'7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdCBuHYmW2hr' },
  { symbol:'MEW',    name:'cat in a dogs world', price:0.0000521, change24h:-2.3, volume24h:42000000, mint:'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUAi9oA' },
  { symbol:'GRASS',  name:'Grass',           price:1.84,   change24h:10.6,  volume24h:78000000,   mint:'Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs' },
  { symbol:'RENDER', name:'Render',          price:4.21,   change24h:5.11,  volume24h:55000000,   mint:'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof' },
  { symbol:'FARTC',  name:'Fartcoin',        price:0.178,  change24h:7.79,  volume24h:48000000,   mint:'9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump' },
  { symbol:'TURBO',  name:'Turbo',           price:0.0089, change24h:5.6,   volume24h:32000000,   mint:'FtgGSFADXBtroxq8VCausXRr2of47QBf5AS1NtZCu4GD' },
  { symbol:'ORCA',   name:'Orca',            price:2.87,   change24h:5.26,  volume24h:28000000,   mint:'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE' },
  { symbol:'PENGU',  name:'Pudgy Penguins',  price:0.0065, change24h:6.48,  volume24h:38000000,   mint:'2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv' },
  { symbol:'TRUMP',  name:'TRUMP',           price:9.82,   change24h:2.09,  volume24h:125000000,  mint:'6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN' },
]

interface Trade {
  value: number
  amount: number
  token: string
  trader: string
  time: string
  type: 'buy'|'sell'
}

const TRADERS = [
  { addr:'HkGz4Kmo...Z7', pnl:88920000, vol:165260000 },
  { addr:'7Z73Wkgc...fc', pnl:17200000, vol:64000000 },
  { addr:'2EEGkWVG...rQ', pnl:8980000,  vol:25900000 },
  { addr:'CarrotLY...Ph', pnl:8390000,  vol:42210000 },
  { addr:'FMR4UZ9o...dh', pnl:8080000,  vol:28680000 },
  { addr:'APiYQMXV...MH', pnl:7730000,  vol:25580000 },
  { addr:'7rc4qWDY...HJ', pnl:5050000,  vol:5070000  },
  { addr:'GFHMc9Be...gx', pnl:4880000,  vol:9830000  },
]

function BubbleMapCanvas({ tokens, onSelect }: { tokens: Token[], onSelect: (t: Token) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bubblesRef = useRef<Array<{x:number;y:number;vx:number;vy:number;r:number;token:Token}>>([])
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight

    bubblesRef.current = tokens.map(token => {
      const r = Math.max(28, Math.min(70, Math.abs(token.change24h) * 4 + Math.log10(token.volume24h) * 3))
      return { x: Math.random()*(W-r*2)+r, y: Math.random()*(H-r*2)+r, vx:(Math.random()-.5)*.4, vy:(Math.random()-.5)*.4, r, token }
    })

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, W, H)

      // Grid
      ctx.strokeStyle = 'rgba(0,212,130,0.03)'
      ctx.lineWidth = 1
      for (let x=0;x<W;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
      for (let y=0;y<H;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}

      const bubbles = bubblesRef.current
      bubbles.forEach(b => {
        b.x+=b.vx; b.y+=b.vy
        if(b.x-b.r<0||b.x+b.r>W) b.vx*=-1
        if(b.y-b.r<0||b.y+b.r>H) b.vy*=-1
        // Collision
        bubbles.forEach(b2 => {
          if(b===b2) return
          const dx=b.x-b2.x, dy=b.y-b2.y
          const dist=Math.sqrt(dx*dx+dy*dy)
          if(dist<b.r+b2.r+4){
            const angle=Math.atan2(dy,dx)
            b.vx+=Math.cos(angle)*0.05; b.vy+=Math.sin(angle)*0.05
          }
        })
      })

      bubbles.forEach(b => {
        const isPos = b.token.change24h >= 0
        const intensity = Math.min(Math.abs(b.token.change24h)/15, 1)
        const color = isPos ? `rgba(0,212,130,${0.12+intensity*0.3})` : `rgba(255,68,68,${0.12+intensity*0.3})`
        const border = isPos ? '#00d4aa' : '#ff4444'

        // Glow
        const grd = ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r*1.3)
        grd.addColorStop(0, isPos?`rgba(0,212,130,${intensity*0.15})`:`rgba(255,68,68,${intensity*0.15})`)
        grd.addColorStop(1,'transparent')
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r*1.3,0,Math.PI*2)
        ctx.fillStyle=grd; ctx.fill()

        // Bubble
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2)
        ctx.fillStyle=color; ctx.fill()
        ctx.strokeStyle=border; ctx.lineWidth=1.5; ctx.stroke()

        // Logo placeholder
        ctx.fillStyle='rgba(255,255,255,0.08)'
        ctx.beginPath(); ctx.arc(b.x,b.y-b.r*0.15,b.r*0.32,0,Math.PI*2); ctx.fill()

        // Symbol
        ctx.fillStyle='#fff'
        ctx.font=`bold ${Math.max(10,b.r*0.3)}px Inter,sans-serif`
        ctx.textAlign='center'; ctx.textBaseline='middle'
        ctx.fillText(b.token.symbol.length>6?b.token.symbol.slice(0,5)+'..':b.token.symbol, b.x, b.y+b.r*0.1)

        // Change
        ctx.fillStyle=border
        ctx.font=`${Math.max(9,b.r*0.25)}px Inter,sans-serif`
        ctx.fillText(`${isPos?'+':''}${b.token.change24h.toFixed(2)}%`, b.x, b.y+b.r*0.38)
      })

      animRef.current = requestAnimationFrame(draw)
    }
    draw()

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx=e.clientX-rect.left, my=e.clientY-rect.top
      bubblesRef.current.forEach(b => {
        if(Math.sqrt((mx-b.x)**2+(my-b.y)**2)<b.r) onSelect(b.token)
      })
    }
    canvas.addEventListener('click', handleClick)
    return () => { cancelAnimationFrame(animRef.current); canvas.removeEventListener('click', handleClick) }
  }, [tokens])

  return <canvas ref={canvasRef} style={{width:'100%',height:'100%',cursor:'pointer',display:'block'}} />
}

export default function MarketPage() {
  const [timeframe, setTimeframe] = useState('24H')
  const [selected, setSelected] = useState<Token|null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [filter, setFilter] = useState('10K')

  useEffect(() => {
    // Simulate live trades
    const gen = () => {
      const tok = SOLANA_TOKENS[Math.floor(Math.random()*SOLANA_TOKENS.length)]
      const val = [10000,50000,100000,1000000][Math.floor(Math.random()*4)]
      setTrades(prev => [{
        value: val + Math.random()*val,
        amount: Math.floor(Math.random()*1000),
        token: tok.symbol,
        trader: Math.random().toString(36).slice(2,6).toUpperCase()+'...'+Math.random().toString(36).slice(2,6).toUpperCase(),
        time: 'just now',
        type: Math.random()>0.5?'buy':'sell'
      }, ...prev].slice(0,20))
    }
    gen()
    const iv = setInterval(gen, 3000)
    return () => clearInterval(iv)
  }, [])

  const trending = [...SOLANA_TOKENS].sort((a,b) => b.change24h-a.change24h)
  const gainers  = [...SOLANA_TOKENS].sort((a,b) => b.change24h-a.change24h).slice(0,5)

  return (
    <div style={{background:'#0d1117',minHeight:'100vh',color:'#e2e8f0',fontFamily:'Inter,sans-serif'}}>
      
      {/* HEADER */}
      <header style={{background:'rgba(22,27,34,0.98)',borderBottom:'1px solid #21262d',padding:'0 20px',height:52,display:'flex',alignItems:'center',gap:16,position:'sticky',top:0,zIndex:100,backdropFilter:'blur(12px)'}}>
        <a href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none'}}>
          <div style={{width:28,height:28,background:'linear-gradient(135deg,#00d4aa,#0066ff)',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',fontFamily:'IBM Plex Mono,monospace'}}>CC</div>
          <span style={{fontSize:13,fontWeight:700,color:'#fff',letterSpacing:'0.02em'}}>CryptoCheck<span style={{color:'#00d4aa'}}>AI</span></span>
        </a>
        <div style={{display:'flex',gap:4,marginLeft:8}}>
          {['Trending','Smart Money','Scanner','Tracker'].map(t => (
            <a key={t} href={t==='Scanner'?'/':'#'} style={{padding:'5px 12px',fontSize:13,color:'#8b949e',textDecoration:'none',borderRadius:6,transition:'all 0.15s'}}
              onMouseEnter={e=>(e.currentTarget.style.color='#e2e8f0')}
              onMouseLeave={e=>(e.currentTarget.style.color='#8b949e')}>{t}</a>
          ))}
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          <div style={{fontSize:11,color:'#00d4aa',border:'1px solid rgba(0,212,130,0.25)',padding:'3px 10px',borderRadius:20,fontFamily:'IBM Plex Mono,monospace',fontWeight:700,display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#00d4aa',display:'inline-block',animation:'pulse 1.5s infinite'}}/>LIVE
          </div>
          <a href="/" style={{padding:'6px 14px',background:'#00d4aa',color:'#0d1117',borderRadius:6,fontSize:12,fontWeight:700,textDecoration:'none'}}>← Dashboard</a>
        </div>
      </header>

      {/* CHAIN TABS */}
      <div style={{background:'#161b22',borderBottom:'1px solid #21262d',padding:'0 20px',display:'flex',gap:4,overflowX:'auto'}}>
        {['ALL CHAINS','SOLANA','BASE','ETHEREUM','BNB CHAIN'].map(c => (
          <button key={c} style={{padding:'10px 16px',fontSize:12,fontWeight:600,color:c==='SOLANA'?'#00d4aa':'#8b949e',background:'transparent',border:'none',cursor:'pointer',borderBottom:c==='SOLANA'?'2px solid #00d4aa':'2px solid transparent',whiteSpace:'nowrap'}}>{c}</button>
        ))}
      </div>

      {/* MAIN GRID */}
      <div style={{display:'grid',gridTemplateColumns:'280px 1fr 300px',gap:0,height:'calc(100vh - 100px)',overflow:'hidden'}}>
        
        {/* LEFT — Trending + Traders */}
        <div style={{borderRight:'1px solid #21262d',overflowY:'auto',background:'#0d1117'}}>
          
          {/* Trending Tokens */}
          <div style={{padding:'12px 16px',borderBottom:'1px solid #21262d',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{display:'flex',gap:8}}>
              <button style={{fontSize:12,fontWeight:700,color:'#e2e8f0',background:'transparent',border:'none',cursor:'pointer'}}>Trending Tokens</button>
              <button style={{fontSize:12,color:'#8b949e',background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>Smart Money <span style={{fontSize:9,background:'#00d4aa',color:'#0d1117',padding:'1px 5px',borderRadius:3,fontWeight:700}}>NEW</span></button>
            </div>
            <button style={{fontSize:11,color:'#00d4aa',background:'transparent',border:'none',cursor:'pointer'}}>View more</button>
          </div>
          <div style={{padding:'4px 0'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:4,padding:'4px 16px 8px',fontSize:10,color:'#6e7681',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase'}}>
              <span>Token</span><span>Price</span><span>24h Chg</span>
            </div>
            {trending.map(t => (
              <div key={t.mint} onClick={()=>setSelected(t)} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:4,padding:'8px 16px',cursor:'pointer',alignItems:'center',transition:'background 0.1s'}}
                onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.03)')}
                onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:24,height:24,borderRadius:'50%',background:t.change24h>=0?'rgba(0,212,130,0.15)':'rgba(255,68,68,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:t.change24h>=0?'#00d4aa':'#ff4444',flexShrink:0}}>{t.symbol.slice(0,2)}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:'#e2e8f0'}}>{t.symbol}</div>
                    <div style={{fontSize:10,color:'#6e7681'}}>{t.name.slice(0,16)}</div>
                  </div>
                </div>
                <div style={{fontSize:12,fontFamily:'IBM Plex Mono,monospace',color:'#e2e8f0',textAlign:'right'}}>${t.price<0.001?t.price.toFixed(8):t.price<1?t.price.toFixed(4):t.price.toFixed(2)}</div>
                <div style={{fontSize:12,fontWeight:700,color:t.change24h>=0?'#00d4aa':'#ff4444',fontFamily:'IBM Plex Mono,monospace',textAlign:'right',minWidth:60}}>{t.change24h>=0?'+':''}{t.change24h.toFixed(2)}%</div>
              </div>
            ))}
          </div>

          {/* Profitable Traders */}
          <div style={{padding:'12px 16px',borderBottom:'1px solid #21262d',borderTop:'1px solid #21262d',display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
            <span style={{fontSize:12,fontWeight:700,color:'#e2e8f0'}}>Profitable Traders</span>
            <button style={{fontSize:11,color:'#00d4aa',background:'transparent',border:'none',cursor:'pointer'}}>View more</button>
          </div>
          <div style={{padding:'4px 0'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:4,padding:'4px 16px 8px',fontSize:10,color:'#6e7681',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase'}}>
              <span>Trader</span><span>7D PnL</span><span>7D Vol</span>
            </div>
            {TRADERS.map((t,i) => (
              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:4,padding:'7px 16px',cursor:'pointer',alignItems:'center'}}
                onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.03)')}
                onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:'#00d4aa',flexShrink:0}}/>
                  <code style={{fontSize:11,color:'#8b949e',fontFamily:'IBM Plex Mono,monospace'}}>{t.addr}</code>
                </div>
                <div style={{fontSize:11,fontWeight:700,color:'#00d4aa',fontFamily:'IBM Plex Mono,monospace',textAlign:'right'}}>+${(t.pnl/1000000).toFixed(2)}M</div>
                <div style={{fontSize:11,color:'#6e7681',fontFamily:'IBM Plex Mono,monospace',textAlign:'right'}}>${(t.vol/1000000).toFixed(2)}M</div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER — Bubble Map */}
        <div style={{display:'flex',flexDirection:'column',background:'#0d1117',position:'relative'}}>
          {/* Timeframe selector */}
          <div style={{padding:'10px 16px',borderBottom:'1px solid #21262d',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
            <span style={{fontSize:12,fontWeight:700,color:'#e2e8f0',marginRight:8}}>BUBBLE MAP</span>
            {['4H','8H','24H','7D','30D','1Y'].map(tf => (
              <button key={tf} onClick={()=>setTimeframe(tf)} style={{padding:'3px 10px',fontSize:11,fontWeight:600,color:tf===timeframe?'#0d1117':'#6e7681',background:tf===timeframe?'#00d4aa':'transparent',border:'none',borderRadius:4,cursor:'pointer'}}>{tf}</button>
            ))}
            {selected && (
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,background:'rgba(0,212,130,0.08)',border:'1px solid rgba(0,212,130,0.2)',borderRadius:6,padding:'4px 12px'}}>
                <span style={{fontSize:12,fontWeight:700,color:'#00d4aa'}}>{selected.symbol}</span>
                <span style={{fontSize:12,color:selected.change24h>=0?'#00d4aa':'#ff4444',fontFamily:'IBM Plex Mono,monospace'}}>{selected.change24h>=0?'+':''}{selected.change24h.toFixed(2)}%</span>
                <a href={`/?scan=${selected.mint}`} style={{fontSize:11,color:'#00d4aa',textDecoration:'none',border:'1px solid rgba(0,212,130,0.3)',padding:'2px 8px',borderRadius:4}}>⚡ Scan</a>
                <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',color:'#6e7681',cursor:'pointer',fontSize:14}}>×</button>
              </div>
            )}
          </div>
          
          {/* Bubble Map Canvas */}
          <div style={{flex:1,position:'relative',overflow:'hidden'}}>
            <BubbleMapCanvas tokens={SOLANA_TOKENS} onSelect={setSelected} />
          </div>

          {/* Find Gems */}
          <div style={{borderTop:'1px solid #21262d',padding:'10px 16px',display:'flex',alignItems:'center',gap:8,flexShrink:0,background:'#0d1117'}}>
            <span style={{fontSize:12,fontWeight:700,color:'#e2e8f0',marginRight:4}}>FIND GEMS</span>
            {['Top Volume','Top Gainers'].map(f => (
              <button key={f} style={{fontSize:11,color:'#8b949e',background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                <span style={{width:8,height:8,borderRadius:'50%',border:'2px solid #f0a500',display:'inline-block'}}/>
                {f}
              </button>
            ))}
            <button style={{fontSize:11,color:'#00d4aa',background:'transparent',border:'none',cursor:'pointer',marginLeft:'auto'}}>Find more</button>
          </div>
        </div>

        {/* RIGHT — Large Trades */}
        <div style={{borderLeft:'1px solid #21262d',overflowY:'auto',background:'#0d1117'}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid #21262d',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,fontWeight:700,color:'#e2e8f0'}}>LARGE TRADES</span>
            <button style={{fontSize:11,color:'#00d4aa',background:'transparent',border:'none',cursor:'pointer'}}>Find more</button>
          </div>
          
          {/* Filter */}
          <div style={{padding:'8px 16px',borderBottom:'1px solid #21262d',display:'flex',gap:8}}>
            {['10K','50K','100K','1M'].map(f => (
              <button key={f} onClick={()=>setFilter(f)} style={{fontSize:11,color:filter===f?'#00d4aa':'#6e7681',background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                <span style={{width:8,height:8,borderRadius:'50%',border:`2px solid ${filter===f?'#00d4aa':'#6e7681'}`,display:'inline-block',background:filter===f?'#00d4aa':'transparent'}}/>
                &gt;${f}
              </button>
            ))}
          </div>

          {/* Column headers */}
          <div style={{display:'grid',gridTemplateColumns:'auto auto auto auto',gap:4,padding:'6px 16px',fontSize:10,color:'#6e7681',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',borderBottom:'1px solid #21262d'}}>
            <span>Value</span><span>Amount</span><span>Traders</span><span>Time</span>
          </div>

          {/* Trades */}
          {trades.map((t,i) => (
            <div key={i} style={{display:'grid',gridTemplateColumns:'auto auto auto auto',gap:4,padding:'8px 16px',borderBottom:'1px solid rgba(255,255,255,0.03)',alignItems:'center',animation:'fadeIn 0.3s ease'}}>
              <div style={{fontSize:12,fontWeight:700,color:'#e2e8f0',fontFamily:'IBM Plex Mono,monospace'}}>${(t.value/1000).toFixed(1)}K</div>
              <div style={{fontSize:11,fontFamily:'IBM Plex Mono,monospace',color:t.type==='buy'?'#00d4aa':'#ff4444'}}>{t.type==='buy'?'+':'-'}{t.amount} <span style={{color:'#6e7681'}}>{t.token}</span></div>
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:t.type==='buy'?'#00d4aa':'#ff4444',flexShrink:0}}/>
                <code style={{fontSize:10,color:'#8b949e',fontFamily:'IBM Plex Mono,monospace'}}>{t.trader}</code>
              </div>
              <div style={{fontSize:10,color:'#6e7681'}}>{t.time}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width:3px }
        ::-webkit-scrollbar-track { background:#0d1117 }
        ::-webkit-scrollbar-thumb { background:#21262d;border-radius:2px }
      `}</style>
    </div>
  )
}
