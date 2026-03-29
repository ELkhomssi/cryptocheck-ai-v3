'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface RecentBuy { token: string; mint: string; amount: string; minutesBefore: number }
interface WhaleWallet {
  address: string; label: string; pnl: string; pnlRaw: number; trades: number; winRate: number
  isInsider: boolean; insiderScore: number; lastAction: string; lastToken: string
  lastTokenMint: string; lastTime: string; tags: string[]; recentBuys: RecentBuy[]
}
interface ActivityItem { action: string; wallet: string; token: string; mint: string; amount: string; time: string; color: string; insider: boolean }

const DEMO_MINTS: Record<string,string> = {
  BONK:'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF:'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  MEW:'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
  POPCAT:'7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  BOME:'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
  MYRO:'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4',
}

const WALLETS: WhaleWallet[] = [
  { address:'7xKP…8gQw', label:'Whale Alpha #1', pnl:'+$284K', pnlRaw:284000, trades:847, winRate:78, isInsider:true, insiderScore:94, lastAction:'BUY', lastToken:'MEW', lastTokenMint:DEMO_MINTS.MEW, lastTime:'2m ago', tags:['INSIDER','WHALE','ALPHA'], recentBuys:[{token:'BONK',mint:DEMO_MINTS.BONK,amount:'180 SOL',minutesBefore:2},{token:'WIF',mint:DEMO_MINTS.WIF,amount:'95 SOL',minutesBefore:4},{token:'MEW',mint:DEMO_MINTS.MEW,amount:'220 SOL',minutesBefore:1}] },
  { address:'3nRT…4mPL', label:'Smart Money #1', pnl:'+$91K', pnlRaw:91000, trades:412, winRate:71, isInsider:true, insiderScore:87, lastAction:'BUY', lastToken:'POPCAT', lastTokenMint:DEMO_MINTS.POPCAT, lastTime:'5m ago', tags:['INSIDER','SMART'], recentBuys:[{token:'POPCAT',mint:DEMO_MINTS.POPCAT,amount:'75 SOL',minutesBefore:3},{token:'BONK',mint:DEMO_MINTS.BONK,amount:'50 SOL',minutesBefore:5}] },
  { address:'DeFi…9hWs', label:'DeFi Degen', pnl:'+$38K', pnlRaw:38000, trades:1204, winRate:58, isInsider:false, insiderScore:42, lastAction:'SELL', lastToken:'BOME', lastTokenMint:DEMO_MINTS.BOME, lastTime:'12m ago', tags:['DEGEN','ALPHA'], recentBuys:[{token:'BOME',mint:DEMO_MINTS.BOME,amount:'30 SOL',minutesBefore:8}] },
  { address:'BotA…3kRf', label:'Sniper Bot Elite', pnl:'+$156K', pnlRaw:156000, trades:5891, winRate:82, isInsider:true, insiderScore:96, lastAction:'BUY', lastToken:'WIF', lastTokenMint:DEMO_MINTS.WIF, lastTime:'1m ago', tags:['INSIDER','BOT','SNIPER'], recentBuys:[{token:'WIF',mint:DEMO_MINTS.WIF,amount:'340 SOL',minutesBefore:1},{token:'MYRO',mint:DEMO_MINTS.MYRO,amount:'180 SOL',minutesBefore:2},{token:'BONK',mint:DEMO_MINTS.BONK,amount:'260 SOL',minutesBefore:3}] },
  { address:'KX2m…2eNs', label:'Market Maker', pnl:'+$67K', pnlRaw:67000, trades:3201, winRate:65, isInsider:false, insiderScore:31, lastAction:'BUY', lastToken:'MYRO', lastTokenMint:DEMO_MINTS.MYRO, lastTime:'8m ago', tags:['MM','LIQUIDITY'], recentBuys:[] },
]

const FEED: ActivityItem[] = [
  {action:'BUY', wallet:'7xKP…8gQw', token:'BONK', mint:DEMO_MINTS.BONK, amount:'180 SOL', time:'2m ago', color:'#22c55e', insider:true},
  {action:'SELL',wallet:'BotA…3kRf', token:'WIF',  mint:DEMO_MINTS.WIF,  amount:'340 SOL', time:'3m ago', color:'#ef4444', insider:true},
  {action:'BUY', wallet:'3nRT…4mPL', token:'POPCAT',mint:DEMO_MINTS.POPCAT,amount:'75 SOL',time:'5m ago', color:'#22c55e', insider:true},
  {action:'BUY', wallet:'7xKP…8gQw', token:'MEW',  mint:DEMO_MINTS.MEW,  amount:'220 SOL', time:'8m ago', color:'#22c55e', insider:true},
  {action:'SELL',wallet:'DeFi…9hWs', token:'BOME', mint:DEMO_MINTS.BOME, amount:'95 SOL',  time:'12m ago',color:'#ef4444', insider:false},
]

function SwapModal({token,mint,onClose}:{token:string;mint:string;onClose:()=>void}) {
  const [amt,setAmt]=useState('0.5')
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(2,4,10,0.92)',backdropFilter:'blur(16px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:340,background:'#07091a',border:'1px solid rgba(34,197,94,0.2)',borderRadius:12,padding:24,fontFamily:'IBM Plex Mono,monospace',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,#22c55e,transparent)'}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'#22c55e',letterSpacing:'0.12em',marginBottom:3}}>⚡ QUICK BUY</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.25)'}}>Via Jupiter DEX · Best Route</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>
        </div>
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:8,padding:'10px 14px',marginBottom:14}}>
          <div style={{fontSize:8,color:'rgba(255,255,255,0.25)',letterSpacing:'0.1em',marginBottom:6}}>TOKEN</div>
          <div style={{fontSize:16,fontWeight:700,color:'#f0f4f8',marginBottom:4}}>${token}</div>
          <div style={{fontSize:8,color:'rgba(255,255,255,0.2)',wordBreak:'break-all',lineHeight:1.5}}>{mint}</div>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8,color:'rgba(255,255,255,0.25)',letterSpacing:'0.1em',marginBottom:6}}>AMOUNT (SOL)</div>
          <div style={{display:'flex',gap:6}}>
            <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} style={{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'8px 12px',color:'#f0f4f8',fontFamily:'IBM Plex Mono,monospace',fontSize:14,outline:'none'}}/>
            {['0.5','1','5'].map(v=>(
              <button key={v} onClick={()=>setAmt(v)} style={{background:amt===v?'rgba(34,197,94,0.15)':'rgba(255,255,255,0.04)',border:`1px solid ${amt===v?'rgba(34,197,94,0.3)':'rgba(255,255,255,0.08)'}`,borderRadius:6,padding:'8px 10px',color:amt===v?'#22c55e':'rgba(255,255,255,0.35)',fontFamily:'IBM Plex Mono,monospace',fontSize:10,cursor:'pointer'}}>{v}</button>
            ))}
          </div>
        </div>
        <a href={`https://jup.ag/swap/SOL-${mint}`} target="_blank" rel="noopener noreferrer" style={{display:'block',textAlign:'center',background:'linear-gradient(135deg,#16a34a,#15803d)',borderRadius:8,padding:'12px 0',color:'#fff',fontFamily:'IBM Plex Mono,monospace',fontSize:12,fontWeight:700,letterSpacing:'0.06em',textDecoration:'none',boxShadow:'0 4px 20px rgba(34,197,94,0.25)'}}>
          SWAP {amt} SOL → ${token} ON JUPITER ↗
        </a>
        <div style={{fontSize:8,color:'rgba(255,255,255,0.15)',textAlign:'center',marginTop:10}}>Not financial advice · DYOR</div>
      </div>
    </div>
  )
}

interface Props { onScanToken?: (mint:string)=>void }

export default function InsiderWhaleIntel({onScanToken}:Props) {
  const [selected,setSelected]=useState<WhaleWallet|null>(null)
  const [filter,setFilter]=useState<'all'|'insider'|'whale'>('all')
  const [pulse,setPulse]=useState(false)
  const [following,setFollowing]=useState<Set<string>>(new Set())
  const [watchlist,setWatchlist]=useState<Set<string>>(new Set())
  const [swap,setSwap]=useState<{token:string;mint:string}|null>(null)
  const [toast,setToast]=useState('')

  useEffect(()=>{const iv=setInterval(()=>setPulse(p=>!p),1500);return()=>clearInterval(iv)},[])

  const toggleFollow=useCallback((e:React.MouseEvent,addr:string)=>{
    e.stopPropagation()
    e.preventDefault()
    setFollowing(prev => {
      const next = new Set(prev)
      if (next.has(addr)) { next.delete(addr) } else { next.add(addr) }
      return next
    })
  },[])
  const toggleWatch=useCallback((e:React.MouseEvent,addr:string)=>{e.stopPropagation();setWatchlist(p=>{const n=new Set(p);n.has(addr)?n.delete(addr):n.add(addr);return n})},[])
  const openSwap=useCallback((e:React.MouseEvent,token:string,mint:string)=>{e.stopPropagation();setSwap({token,mint})},[])
  const scanBefore=useCallback((e:React.MouseEvent,mint:string)=>{e.stopPropagation();if(onScanToken){onScanToken(mint)}else{navigator.clipboard.writeText(mint);setToast('Mint copied — paste in Neural V4');setTimeout(()=>setToast(''),2500)}},[onScanToken])

  const filtered=WALLETS.filter(w=>filter==='insider'?w.isInsider:filter==='whale'?w.pnlRaw>100000:true)

  const N={
    card:'background:#07091a;border:1px solid rgba(255,255,255,0.07);border-radius:8px',
    cardElite:'background:linear-gradient(160deg,rgba(251,191,36,0.05) 0%,#07091a 60%);border:1px solid rgba(251,191,36,0.14);border-radius:8px',
    label:{fontSize:9,letterSpacing:'0.1em',color:'rgba(255,255,255,0.3)',marginBottom:4,fontWeight:500} as React.CSSProperties,
    val:{fontSize:13,fontWeight:700,color:'#f0f4f8'} as React.CSSProperties,
    pill:(active:boolean,c='#6366f1')=>({padding:'2px 10px',borderRadius:4,fontSize:8,fontWeight:700,letterSpacing:'0.06em',cursor:'pointer',border:`1px solid ${active?c+'55':'rgba(255,255,255,0.08)'}`,background:active?c+'18':'transparent',color:active?c:'rgba(255,255,255,0.35)',fontFamily:'IBM Plex Mono,monospace'} as React.CSSProperties),
    btn:(c='#6366f1')=>({padding:'5px 12px',borderRadius:5,fontSize:9,fontWeight:700,cursor:'pointer',border:`1px solid ${c}33`,background:`${c}12`,color:c,fontFamily:'IBM Plex Mono,monospace',whiteSpace:'nowrap'} as React.CSSProperties),
  }

  return (
    <>
      <style>{`
        @keyframes eliteGlow{0%,100%{box-shadow:0 0 8px rgba(251,191,36,0.25)}50%{box-shadow:0 0 18px rgba(251,191,36,0.55),0 0 35px rgba(251,191,36,0.15)}}
        @keyframes scorePulse{0%,100%{box-shadow:none}50%{box-shadow:0 0 10px currentColor}}
        @keyframes radarSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes ping{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:0.4}}
        @keyframes followGlow{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.0)}50%{box-shadow:0 0 0 3px rgba(34,197,94,0.12)}}
      `}</style>

      {toast&&<div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#07091a',border:'1px solid rgba(167,139,250,0.35)',borderRadius:8,padding:'10px 20px',zIndex:9998,fontSize:11,color:'#a78bfa',fontFamily:'IBM Plex Mono,monospace',boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>🧠 {toast}</div>}
      {swap&&<SwapModal token={swap.token} mint={swap.mint} onClose={()=>setSwap(null)}/>}

      <div style={{fontFamily:'IBM Plex Mono,monospace',color:'#f0f4f8'}}>

        {/* ── HEADER ── */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,paddingBottom:12,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{position:'relative',width:8,height:8}}>
              <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'#fbbf24',animation:'ping 1.5s ease-in-out infinite'}}/>
              <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'#fbbf24'}}/>
            </div>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'#fbbf24'}}>INSIDER WHALE INTELLIGENCE</span>
            <span style={{fontSize:8,color:'rgba(255,255,255,0.2)',letterSpacing:'0.06em'}}>SOLANA MAINNET · LIVE</span>
          </div>
          <div style={{display:'flex',gap:4}}>
            {(['all','insider','whale'] as const).map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={N.pill(filter===f,'#fbbf24')}>{f.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {/* ── WATCHLIST ── */}
        {watchlist.size>0&&(
          <div style={{background:'rgba(56,189,248,0.04)',border:'1px solid rgba(56,189,248,0.12)',borderRadius:8,padding:'10px 14px',marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" style={{animation:'radarSpin 3s linear infinite',flexShrink:0}}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="5"/></svg>
              <span style={{fontSize:9,fontWeight:700,color:'#38bdf8',letterSpacing:'0.1em'}}>RADAR WATCHLIST — {watchlist.size} TRACKED</span>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {WALLETS.filter(w=>watchlist.has(w.address)).map(w=>(
                <div key={w.address} style={{display:'flex',alignItems:'center',gap:6,background:'rgba(56,189,248,0.07)',border:'1px solid rgba(56,189,248,0.15)',borderRadius:5,padding:'3px 10px'}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:'#38bdf8',animation:'ping 0.8s ease-in-out infinite'}}/>
                  <span style={{fontSize:9,color:'#38bdf8',fontWeight:600}}>{w.label}</span>
                  <button onClick={e=>toggleWatch(e,w.address)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.25)',cursor:'pointer',fontSize:12,lineHeight:1,padding:0}}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── WALLET CARDS ── */}
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
          {filtered.map(w=>{
            const isF=following.has(w.address),isW=watchlist.has(w.address),isSel=selected?.address===w.address
            const scoreColor=w.insiderScore>=85?'#fbbf24':w.insiderScore>=70?'#a78bfa':'#38bdf8'
            return (
              <div key={w.address} onClick={()=>setSelected(isSel?null:w)} style={{
                background:w.isInsider?'linear-gradient(160deg,rgba(251,191,36,0.04) 0%,#07091a 60%)':'rgba(255,255,255,0.02)',
                border:isF?'1px solid rgba(34,197,94,0.28)':w.isInsider?'1px solid rgba(251,191,36,0.13)':'1px solid rgba(255,255,255,0.06)',
                borderRadius:8,padding:'12px 16px',cursor:'pointer',transition:'border 0.2s',
                animation:isF?'followGlow 2s ease-in-out infinite':'none',
              }}>
                {/* Row 1 — identity */}
                <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8}}>
                  <div style={{width:32,height:32,borderRadius:6,background:w.isInsider?'rgba(251,191,36,0.1)':'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0,boxShadow:w.insiderScore>=85?'0 0 12px rgba(251,191,36,0.2)':'none'}}>
                    {w.insiderScore>=85?'◆':w.insiderScore>=70?'◈':'○'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3,flexWrap:'wrap'}}>
                      <span style={{fontSize:12,fontWeight:700,color:'#f0f4f8'}}>{w.label}</span>
                      {w.insiderScore>=85&&<span style={{display:'inline-flex',alignItems:'center',gap:3,background:'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(239,68,68,0.1))',border:'1px solid rgba(245,158,11,0.4)',borderRadius:4,padding:'2px 7px',fontSize:8,fontWeight:700,color:'#fbbf24',letterSpacing:'0.07em',animation:'eliteGlow 2s ease-in-out infinite'}}>◆ ELITE INSIDER</span>}
                      {w.insiderScore>=70&&w.insiderScore<85&&<span style={{display:'inline-flex',background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.28)',borderRadius:4,padding:'2px 7px',fontSize:8,fontWeight:700,color:'#a78bfa',letterSpacing:'0.07em'}}>◈ INSIDER</span>}
                      {isF&&<span style={{fontSize:8,color:'#22c55e',background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.22)',borderRadius:3,padding:'1px 6px'}}>● COPYING</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:9,color:'rgba(255,255,255,0.25)',fontFamily:'monospace'}}>{w.address}</span>
                    </div>
                  </div>
                  {/* PnL */}
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:'#22c55e',letterSpacing:'-0.01em'}}>{w.pnl}</div>
                    <div style={{fontSize:8,color:'rgba(255,255,255,0.25)',marginTop:2}}>{w.winRate}% win · {w.trades} trades</div>
                  </div>
                </div>

                {/* Row 2 — score bar */}
                {w.isInsider&&(
                  <div style={{marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:8,color:'rgba(255,255,255,0.25)',letterSpacing:'0.08em'}}>INSIDER SCORE</span>
                      <span style={{fontSize:9,fontWeight:700,color:scoreColor}}>{w.insiderScore}</span>
                    </div>
                    <div style={{height:3,background:'rgba(255,255,255,0.05)',borderRadius:2,overflow:'hidden',position:'relative'}}>
                      <div style={{width:`${w.insiderScore}%`,height:'100%',background:scoreColor,borderRadius:2,transition:'width 1s ease',boxShadow:pulse?`0 0 8px ${scoreColor}`:'none'}}/>
                    </div>
                  </div>
                )}

                {/* Row 3 — tags + last action */}
                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:8,flexWrap:'wrap'}}>
                  {w.tags.map(t=>(
                    <span key={t} style={{fontSize:8,padding:'1px 6px',borderRadius:3,background:t==='INSIDER'?'rgba(251,191,36,0.08)':'rgba(255,255,255,0.04)',color:t==='INSIDER'?'#fbbf24':'rgba(255,255,255,0.3)',border:`1px solid ${t==='INSIDER'?'rgba(251,191,36,0.18)':'rgba(255,255,255,0.07)'}`}}>{t}</span>
                  ))}
                  <div style={{marginLeft:'auto',fontSize:9}}>
                    <span style={{fontWeight:700,color:w.lastAction==='BUY'?'#22c55e':'#ef4444'}}>{w.lastAction}</span>
                    <span style={{color:'rgba(255,255,255,0.35)'}}> {w.lastToken} · {w.lastTime}</span>
                  </div>
                </div>

                {/* Row 4 — action buttons */}
                <div style={{display:'flex',gap:5,position:'relative',zIndex:10}} onClick={e=>{e.stopPropagation();e.preventDefault()}}>
                  <button onMouseDown={e=>{e.stopPropagation();e.preventDefault();setFollowing(p=>{const n=new Set(p);n.has(w.address)?n.delete(w.address):n.add(w.address);return n})}} style={{...N.btn(isF?'#22c55e':'#6b7280'),flex:1,padding:'5px 0',textAlign:'center'}}>
                    {isF?'✓ COPYING TRADES':'⟳ FOLLOW & COPY'}
                  </button>
                  <button onClick={e=>toggleWatch(e,w.address)} style={{...N.btn(isW?'#38bdf8':'#6b7280'),padding:'5px 10px'}} title={isW?'Remove from radar':'Add to radar'}>
                    {isW?'📡':'🔭'}
                  </button>
                  <button onClick={e=>openSwap(e,w.lastToken,w.lastTokenMint)} style={{...N.btn('#22c55e')}}>
                    ⚡ BUY {w.lastToken}
                  </button>
                </div>

                {/* Expanded entries */}
                {isSel&&w.recentBuys.length>0&&(
                  <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{fontSize:8,color:'rgba(255,255,255,0.25)',letterSpacing:'0.1em',marginBottom:8}}>INSIDER ENTRIES — BEFORE ALPHA ALERT</div>
                    {w.recentBuys.map((b,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',marginBottom:4,background:'rgba(34,197,94,0.03)',border:'1px solid rgba(34,197,94,0.09)',borderRadius:5,fontSize:9}}>
                        <span style={{color:'#fbbf24'}}>◆</span>
                        <span style={{fontWeight:700,color:'#f0f4f8'}}>${b.token}</span>
                        <span style={{color:'#22c55e'}}>{b.amount}</span>
                        <span style={{marginLeft:'auto',color:'#f59e0b',fontWeight:700}}>{b.minutesBefore}min early</span>
                        <button onClick={e=>openSwap(e,b.token,b.mint)} style={N.btn('#22c55e')}>⚡ BUY</button>
                        <button onClick={e=>scanBefore(e,b.mint)} style={N.btn('#a78bfa')}>🧠 SCAN</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── ACTIVITY FEED ── */}
        <div style={{background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,padding:'12px 16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',color:'rgba(255,255,255,0.25)'}}>RECENT SMART MONEY ACTIVITY</span>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:'#22c55e',animation:'ping 1.5s ease-in-out infinite'}}/>
              <span style={{fontSize:8,color:'rgba(255,255,255,0.2)'}}>LIVE</span>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:0}}>
            {FEED.map((a,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:i<FEED.length-1?'1px solid rgba(255,255,255,0.04)':'none',fontSize:10}}>
                <span style={{color:a.color,fontWeight:700,background:`${a.color}12`,padding:'2px 7px',borderRadius:3,fontSize:8,width:36,textAlign:'center',flexShrink:0}}>{a.action}</span>
                <span style={{color:'rgba(255,255,255,0.3)',flexShrink:0,fontSize:9}}>{a.wallet}</span>
                <span style={{fontWeight:700,color:'#f0f4f8',flexShrink:0}}>${a.token}</span>
                <span style={{color:'#a78bfa',flexShrink:0}}>{a.amount}</span>
                {a.insider&&<span style={{fontSize:8,color:'#fbbf24',flexShrink:0}}>◆</span>}
                <span style={{marginLeft:'auto',color:'rgba(255,255,255,0.2)',fontSize:9,flexShrink:0}}>{a.time}</span>
                {a.action==='BUY'&&<button onClick={e=>openSwap(e,a.token,a.mint)} style={{...N.btn('#22c55e'),flexShrink:0}}>⚡ BUY</button>}
                <button onClick={e=>scanBefore(e,a.mint)} style={{...N.btn('#a78bfa'),flexShrink:0}}>🧠 SCAN</button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}
