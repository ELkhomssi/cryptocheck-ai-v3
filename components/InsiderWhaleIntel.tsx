'use client'

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react'
import { getClientSolanaRpcUrl } from '@/lib/helius'
import { loadEncryptedKey } from '@/lib/crypto/client-key-store'

interface RecentBuy {
  token: string
  mint: string
  amount: string
  minutesBefore: number
}
interface WhaleWallet {
  /** Stable list key for API-sourced rows (full mint authority / fee payer). */
  rowId?: string
  address: string
  label: string
  pnl: string
  pnlRaw: number
  trades: number
  winRate: number
  isInsider: boolean
  insiderScore: number
  lastAction: string
  lastToken: string
  lastTokenMint: string
  lastTime: string
  tags: string[]
  recentBuys: RecentBuy[]
}
interface ActivityItem {
  action: string
  wallet: string
  token: string
  mint: string
  amount: string
  time: string
  color: string
  insider: boolean
}

const DEMO_MINTS: Record<string, string> = {
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  MEW: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
  POPCAT: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  BOME: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
  MYRO: 'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4',
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

/** JSON-RPC through our in-origin proxy — no CryptoCheck auth headers on this request. */
async function solanaRpc<T>(method: string, params: unknown[] = []): Promise<T | null> {
  try {
    const url = getClientSolanaRpcUrl()
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    const json = (await res.json().catch(() => null)) as { error?: { message?: string }; result?: T } | null
    if (!json || json?.error) return null
    return json.result ?? null
  } catch {
    return null
  }
}

function formatRelativeTime(blockTime: number | null | undefined): string {
  if (blockTime == null || typeof blockTime !== 'number') return '—'
  const sec = Date.now() / 1000 - blockTime
  if (sec < 60) return `${Math.max(0, Math.floor(sec))}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function shortenSig(sig: string | undefined): string {
  if (!sig || sig.length < 10) return '…'
  return `${sig.slice(0, 4)}…${sig.slice(-4)}`
}

function parseSignaturesToActivity(raw: unknown): ActivityItem[] {
  if (!Array.isArray(raw)) return []
  const out: ActivityItem[] = []
  for (const row of raw) {
    const r = row as Record<string, unknown> | null
    const sig = typeof r?.signature === 'string' ? r.signature : ''
    if (!sig) continue
    const bt = typeof r?.blockTime === 'number' ? r.blockTime : null
    const err = r?.err
    const action = err != null && err !== undefined ? 'FAIL' : 'POOL'
    out.push({
      action,
      wallet: shortenSig(sig),
      token: 'BONK',
      mint: DEMO_MINTS.BONK,
      amount: 'chain',
      time: formatRelativeTime(bt),
      color: action === 'FAIL' ? '#ef4444' : '#38bdf8',
      insider: false,
    })
    if (out.length >= 10) break
  }
  return out
}

function mapApiWhaleToWallet(raw: unknown): WhaleWallet | null {
  const w = raw as Record<string, unknown> | null
  const addr = typeof w?.address === 'string' ? w.address : ''
  if (!addr || addr.length < 8) return null
  const short =
    typeof w?.shortAddr === 'string' && w.shortAddr.length > 4
      ? w.shortAddr
      : `${addr.slice(0, 4)}…${addr.slice(-4)}`
  const pnlStr = typeof w?.pnl === 'string' ? w.pnl : '+$0K'
  const scoreNum = typeof w?.score === 'number' && !Number.isNaN(w.score) ? w.score : 50
  const pnlRaw =
    typeof w?.pnl === 'string'
      ? (() => {
          const m = w.pnl.match(/(\d+(?:\.\d+)?)\s*K/i)
          if (m) return Math.round(parseFloat(m[1]) * 1000)
          const digits = parseInt(w.pnl.replace(/\D/g, ''), 10)
          return Number.isFinite(digits) ? digits : scoreNum * 1200
        })()
      : (Number(w?.pnl) || scoreNum * 1200)
  const trades = typeof w?.trades === 'number' && !Number.isNaN(w.trades) ? w.trades : 0
  const winRate = typeof w?.winRate === 'number' && !Number.isNaN(w.winRate) ? w.winRate : 0
  const score = scoreNum
  const lastActionStr = typeof w?.lastAction === 'string' ? w.lastAction : 'BUY · live'
  const badge = typeof w?.badge === 'string' ? w.badge : 'LIVE'
  const tier = typeof w?.tier === 'string' ? w.tier : ''
  const tags = ['LIVE', 'RPC', ...(tier === 'insider' ? ['INSIDER'] : []), ...(badge ? [badge] : [])].slice(0, 6)

  return {
    rowId: addr,
    address: short,
    label: `${badge}`.slice(0, 48),
    pnl: pnlStr,
    pnlRaw,
    trades,
    winRate,
    isInsider: tier === 'insider' || score >= 80,
    insiderScore: Math.min(100, Math.max(0, score)),
    lastAction: lastActionStr.split('·')[0]?.trim() || 'BUY',
    lastToken: 'BONK',
    lastTokenMint: DEMO_MINTS.BONK,
    lastTime: 'live',
    tags,
    recentBuys: [],
  }
}

function SwapModal({ token, mint, onClose }: { token: string; mint: string; onClose: () => void }) {
  const [amt, setAmt] = useState('0.5')
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

function ActivitySkeletonRow({ i }: { i: number }) {
  return (
    <div
      key={`sk-${i}`}
      style={{
        display:'flex',alignItems:'center',gap:8,padding:'8px 0',
        borderBottom:'1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div style={{ width:36,height:18,borderRadius:4,background:'rgba(255,255,255,0.06)',animation:'pulseSk 1.2s ease-in-out infinite',animationDelay:`${i * 0.08}s` }} />
      <div style={{ flex:1,height:12,borderRadius:3,background:'rgba(255,255,255,0.05)',animation:'pulseSk 1.2s ease-in-out infinite',animationDelay:`${i * 0.08}s` }} />
      <div style={{ width:48,height:12,borderRadius:3,background:'rgba(255,255,255,0.04)',animation:'pulseSk 1.2s ease-in-out infinite',animationDelay:`${i * 0.08}s` }} />
    </div>
  )
}

interface Props { onScanToken?: (mint: string) => void }

function InsiderWhaleIntelImpl({ onScanToken }: Props) {
  const [selected, setSelected] = useState<WhaleWallet | null>(null)
  const [filter, setFilter] = useState<'all'|'insider'|'whale'>('all')
  const [pulse, setPulse] = useState(false)
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set())
  const [swap, setSwap] = useState<{ token: string; mint: string } | null>(null)
  const [toast, setToast] = useState('')

  const [liveSlot, setLiveSlot] = useState<number | null>(null)
  const [liveFeedRows, setLiveFeedRows] = useState<ActivityItem[]>([])
  const [feedPollReady, setFeedPollReady] = useState(false)
  const [rpcHint, setRpcHint] = useState<string | null>(null)
  const [intelWhales, setIntelWhales] = useState<unknown[]>([])

  const apiKeyRef = useRef<string | null>(null)
  /** Flips true once `loadEncryptedKey` settles — drives whale-intel polling without re-running RPC poll. */
  const [keyHydrated, setKeyHydrated] = useState(false)

  useEffect(() => {
    const iv = setInterval(() => setPulse(p => !p), 1500)
    return () => clearInterval(iv)
  }, [])

  /** Load API key exactly once — never inside the live poll loop (avoids re-auth churn + layout thrash). */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const k = await loadEncryptedKey()
        if (!cancelled) apiKeyRef.current = k
      } catch {
        if (!cancelled) apiKeyRef.current = null
      } finally {
        if (!cancelled) setKeyHydrated(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const pollRpc = useCallback(async () => {
    try {
      const slot = await solanaRpc<number>('getSlot', [])
      if (typeof slot === 'number' && !Number.isNaN(slot)) setLiveSlot(slot)

      const sigs = await solanaRpc<unknown>('getSignaturesForAddress', [
        DEMO_MINTS.BONK,
        { limit: 14 },
      ])
      const parsed = parseSignaturesToActivity(sigs)
      setLiveFeedRows(parsed)
      setRpcHint(null)
    } catch {
      setRpcHint('RPC update skipped')
    } finally {
      setFeedPollReady(true)
    }
  }, [])

  useEffect(() => {
    void pollRpc()
    const id = setInterval(() => { void pollRpc() }, 18_000)
    return () => clearInterval(id)
  }, [pollRpc])

  /** Optional enriched wallets — key read from ref only; interval never re-fetches the key. */
  useEffect(() => {
    if (!keyHydrated) return
    const fetchIntel = async () => {
      const key = apiKeyRef.current
      if (!key) return
      try {
        const res = await fetch('/api/whale-intel', {
          headers: { Authorization: `Bearer ${key}` },
        })
        const json = (await res.json().catch(() => null)) as {
          success?: boolean
          whales?: unknown[]
        } | null
        const arr = json?.whales
        if (json?.success && Array.isArray(arr)) {
          setIntelWhales(arr.filter(Boolean).slice(0, 8))
        }
      } catch {
        /* ignore — live RPC feed still works */
      }
    }
    void fetchIntel()
    const id = setInterval(() => { void fetchIntel() }, 45_000)
    return () => clearInterval(id)
  }, [keyHydrated])

  const mergedWallets = useMemo(() => {
    const fromApi = intelWhales
      .map(mapApiWhaleToWallet)
      .filter((x): x is WhaleWallet => x != null)
    return [...fromApi, ...WALLETS]
  }, [intelWhales])

  const displayFeed = useMemo(() => {
    const live = liveFeedRows ?? []
    const demo = FEED ?? []
    if (live.length === 0) return demo
    const merged = [...live, ...demo]
    const seen = new Set<string>()
    const out: ActivityItem[] = []
    for (const row of merged) {
      const k = `${row?.action ?? ''}-${row?.wallet ?? ''}-${row?.time ?? ''}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push(row)
      if (out.length >= 12) break
    }
    return out
  }, [liveFeedRows])

  const toggleFollow = useCallback((e: MouseEvent, addr: string) => {
    e.stopPropagation()
    e.preventDefault()
    setFollowing(prev => {
      const next = new Set(prev)
      if (next.has(addr)) next.delete(addr)
      else next.add(addr)
      return next
    })
  }, [])

  const toggleWatch = useCallback((e: MouseEvent, addr: string) => {
    e.stopPropagation()
    setWatchlist(p => {
      const n = new Set(p)
      if (n.has(addr)) n.delete(addr)
      else n.add(addr)
      return n
    })
  }, [])

  const openSwap = useCallback((e: MouseEvent, token: string, mint: string) => {
    e.stopPropagation()
    setSwap({ token, mint })
  }, [])

  const scanBefore = useCallback((e: MouseEvent, mint: string) => {
    e.stopPropagation()
    if (onScanToken) {
      onScanToken(mint)
    } else {
      void navigator.clipboard?.writeText?.(mint)
      setToast('Mint copied — paste in Neural V4')
      setTimeout(() => setToast(''), 2500)
    }
  }, [onScanToken])

  const filtered = mergedWallets.filter(w => {
    if (!w) return false
    if (filter === 'insider') return w.isInsider === true
    if (filter === 'whale') return (w.pnlRaw ?? 0) > 100000
    return true
  })

  const N = useMemo(() => ({
    card:'background:#07091a;border:1px solid rgba(255,255,255,0.07);border-radius:8px',
    cardElite:'background:linear-gradient(160deg,rgba(251,191,36,0.05) 0%,#07091a 60%);border:1px solid rgba(251,191,36,0.14);border-radius:8px',
    label:{fontSize:9,letterSpacing:'0.1em',color:'rgba(255,255,255,0.3)',marginBottom:4,fontWeight:500} as CSSProperties,
    val:{fontSize:13,fontWeight:700,color:'#f0f4f8'} as CSSProperties,
    pill:(active: boolean, c = '#6366f1') => ({
      padding:'2px 10px', borderRadius:4, fontSize:8, fontWeight:700, letterSpacing:'0.06em', cursor:'pointer',
      border:`1px solid ${active ? c + '55' : 'rgba(255,255,255,0.08)'}`, background:active ? c + '18' : 'transparent',
      color:active ? c : 'rgba(255,255,255,0.35)', fontFamily:'IBM Plex Mono,monospace',
    }) as CSSProperties,
    btn:(c = '#6366f1') => ({
      padding:'5px 12px', borderRadius:5, fontSize:9, fontWeight:700, cursor:'pointer',
      border:`1px solid ${c}33`, background:`${c}12`, color:c, fontFamily:'IBM Plex Mono,monospace', whiteSpace:'nowrap',
    }) as CSSProperties,
  }), [])

  return (
    <>
      <style>{`
        @keyframes eliteGlow{0%,100%{box-shadow:0 0 8px rgba(251,191,36,0.25)}50%{box-shadow:0 0 18px rgba(251,191,36,0.55),0 0 35px rgba(251,191,36,0.15)}}
        @keyframes scorePulse{0%,100%{box-shadow:none}50%{box-shadow:0 0 10px currentColor}}
        @keyframes radarSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes ping{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:0.4}}
        @keyframes followGlow{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.0)}50%{box-shadow:0 0 0 3px rgba(34,197,94,0.12)}}
        @keyframes pulseSk{0%,100%{opacity:0.35}50%{opacity:0.85}}
      `}</style>

      {toast ? <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'#07091a',border:'1px solid rgba(167,139,250,0.35)',borderRadius:8,padding:'10px 20px',zIndex:9998,fontSize:11,color:'#a78bfa',fontFamily:'IBM Plex Mono,monospace',boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>🧠 {toast}</div> : null}
      {swap ? <SwapModal token={swap.token} mint={swap.mint} onClose={() => setSwap(null)} /> : null}

      <div style={{fontFamily:'IBM Plex Mono,monospace',color:'#f0f4f8',minHeight:320}}>

        {/* ── HEADER (always visible — no white screen) ── */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,paddingBottom:12,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <div style={{position:'relative',width:8,height:8}}>
              <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'#fbbf24',animation:'ping 1.5s ease-in-out infinite'}}/>
              <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'#fbbf24'}}/>
            </div>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'#fbbf24'}}>INSIDER WHALE INTELLIGENCE</span>
            <span style={{fontSize:8,color:'rgba(255,255,255,0.2)',letterSpacing:'0.06em'}}>SOLANA MAINNET · LIVE</span>
            {liveSlot != null ? (
              <span style={{fontSize:8,color:'rgba(56,189,248,0.85)',letterSpacing:'0.04em'}}>
                · SLOT {liveSlot.toLocaleString?.() ?? liveSlot}
              </span>
            ) : (
              <span style={{fontSize:8,color:'rgba(148,163,184,0.7)'}}>· syncing…</span>
            )}
            {rpcHint ? <span style={{fontSize:7,color:'rgba(248,113,113,0.8)'}}>{rpcHint}</span> : null}
          </div>
          <div style={{display:'flex',gap:4}}>
            {(['all','insider','whale'] as const).map(f => (
              <button key={f} type="button" onClick={() => setFilter(f)} style={N.pill(filter === f, '#fbbf24')}>{f.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {/* ── WATCHLIST ── */}
        {watchlist.size > 0 ? (
          <div style={{background:'rgba(56,189,248,0.04)',border:'1px solid rgba(56,189,248,0.12)',borderRadius:8,padding:'10px 14px',marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" style={{animation:'radarSpin 3s linear infinite',flexShrink:0}}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="5"/></svg>
              <span style={{fontSize:9,fontWeight:700,color:'#38bdf8',letterSpacing:'0.1em'}}>RADAR WATCHLIST — {watchlist.size} TRACKED</span>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {mergedWallets.filter(w => watchlist.has(w?.address ?? '')).map((w, wi) => (
                <div key={w?.address ? `wl-${w.address}` : `wl-${wi}`} style={{display:'flex',alignItems:'center',gap:6,background:'rgba(56,189,248,0.07)',border:'1px solid rgba(56,189,248,0.15)',borderRadius:5,padding:'3px 10px'}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:'#38bdf8',animation:'ping 0.8s ease-in-out infinite'}}/>
                  <span style={{fontSize:9,color:'#38bdf8',fontWeight:600}}>{w?.label ?? '—'}</span>
                  <button type="button" onClick={e => toggleWatch(e, w?.address ?? '')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.25)',cursor:'pointer',fontSize:12,lineHeight:1,padding:0}}>×</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── WALLET CARDS ── */}
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
          {filtered.map(w => {
            if (!w) return null
            const rowKey = w.rowId ?? w.address ?? ''
            const addr = w.address ?? ''
            const isF = following.has(addr)
            const isW = watchlist.has(addr)
            const isSel = selected?.address === w.address
            const score = w.insiderScore ?? 0
            const scoreColor = score >= 85 ? '#fbbf24' : score >= 70 ? '#a78bfa' : '#38bdf8'
            const tags = Array.isArray(w.tags) ? w.tags : []
            const recent = Array.isArray(w.recentBuys) ? w.recentBuys : []
            return (
              <div key={rowKey} onClick={() => setSelected(isSel ? null : w)} style={{
                background:w.isInsider ? 'linear-gradient(160deg,rgba(251,191,36,0.04) 0%,#07091a 60%)' : 'rgba(255,255,255,0.02)',
                border:isF ? '1px solid rgba(34,197,94,0.28)' : w.isInsider ? '1px solid rgba(251,191,36,0.13)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius:8,padding:'12px 16px',cursor:'pointer',transition:'border 0.2s',
                animation:isF ? 'followGlow 2s ease-in-out infinite' : 'none',
              }}>
                <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8}}>
                  <div style={{width:32,height:32,borderRadius:6,background:w.isInsider ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0,boxShadow:score >= 85 ? '0 0 12px rgba(251,191,36,0.2)' : 'none'}}>
                    {score >= 85 ? '◆' : score >= 70 ? '◈' : '○'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3,flexWrap:'wrap'}}>
                      <span style={{fontSize:12,fontWeight:700,color:'#f0f4f8'}}>{w.label ?? '—'}</span>
                      {score >= 85 ? <span style={{display:'inline-flex',alignItems:'center',gap:3,background:'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(239,68,68,0.1))',border:'1px solid rgba(245,158,11,0.4)',borderRadius:4,padding:'2px 7px',fontSize:8,fontWeight:700,color:'#fbbf24',letterSpacing:'0.07em',animation:'eliteGlow 2s ease-in-out infinite'}}>◆ ELITE INSIDER</span> : null}
                      {score >= 70 && score < 85 ? <span style={{display:'inline-flex',background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.28)',borderRadius:4,padding:'2px 7px',fontSize:8,fontWeight:700,color:'#a78bfa',letterSpacing:'0.07em'}}>◈ INSIDER</span> : null}
                      {isF ? <span style={{fontSize:8,color:'#22c55e',background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.22)',borderRadius:3,padding:'1px 6px'}}>● COPYING</span> : null}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:9,color:'rgba(255,255,255,0.25)',fontFamily:'monospace'}}>{addr}</span>
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:'#22c55e',letterSpacing:'-0.01em'}}>{w.pnl ?? '—'}</div>
                    <div style={{fontSize:8,color:'rgba(255,255,255,0.25)',marginTop:2}}>{w.winRate ?? 0}% win · {w.trades ?? 0} trades</div>
                  </div>
                </div>

                {w.isInsider ? (
                  <div style={{marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:8,color:'rgba(255,255,255,0.25)',letterSpacing:'0.08em'}}>INSIDER SCORE</span>
                      <span style={{fontSize:9,fontWeight:700,color:scoreColor}}>{score}</span>
                    </div>
                    <div style={{height:3,background:'rgba(255,255,255,0.05)',borderRadius:2,overflow:'hidden',position:'relative'}}>
                      <div style={{width:`${Math.min(100, Math.max(0, score))}%`,height:'100%',background:scoreColor,borderRadius:2,transition:'width 1s ease',boxShadow:pulse ? `0 0 8px ${scoreColor}` : 'none'}}/>
                    </div>
                  </div>
                ) : null}

                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:8,flexWrap:'wrap'}}>
                  {tags.map(t => (
                    <span key={t} style={{fontSize:8,padding:'1px 6px',borderRadius:3,background:t === 'INSIDER' ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)',color:t === 'INSIDER' ? '#fbbf24' : 'rgba(255,255,255,0.3)',border:`1px solid ${t === 'INSIDER' ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.07)'}`}}>{t}</span>
                  ))}
                  <div style={{marginLeft:'auto',fontSize:9}}>
                    <span style={{fontWeight:700,color:(w.lastAction ?? '').includes('SELL') ? '#ef4444' : '#22c55e'}}>{(w.lastAction ?? 'BUY').split('·')[0]?.trim()}</span>
                    <span style={{color:'rgba(255,255,255,0.35)'}}> {w.lastToken ?? '—'} · {w.lastTime ?? ''}</span>
                  </div>
                </div>

                <div style={{display:'flex',gap:5,position:'relative',zIndex:10}} onClick={e => { e.stopPropagation(); e.preventDefault() }}>
                  <button type="button" onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setFollowing(p => { const n = new Set(p); n.has(addr) ? n.delete(addr) : n.add(addr); return n }) }} style={{...N.btn(isF ? '#22c55e' : '#6b7280'),flex:1,padding:'5px 0',textAlign:'center'}}>
                    {isF ? '✓ COPYING TRADES' : '⟳ FOLLOW & COPY'}
                  </button>
                  <button type="button" onClick={e => toggleWatch(e, addr)} style={{...N.btn(isW ? '#38bdf8' : '#6b7280'),padding:'5px 10px'}} title={isW ? 'Remove from radar' : 'Add to radar'}>
                    {isW ? '📡' : '🔭'}
                  </button>
                  <button type="button" onClick={e => openSwap(e, w.lastToken ?? 'BONK', w.lastTokenMint ?? DEMO_MINTS.BONK)} style={{...N.btn('#22c55e')}}>
                    ⚡ BUY {w.lastToken ?? ''}
                  </button>
                </div>

                {isSel && recent.length > 0 ? (
                  <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{fontSize:8,color:'rgba(255,255,255,0.25)',letterSpacing:'0.1em',marginBottom:8}}>INSIDER ENTRIES — BEFORE ALPHA ALERT</div>
                    {recent.map((b, i) => (
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',marginBottom:4,background:'rgba(34,197,94,0.03)',border:'1px solid rgba(34,197,94,0.09)',borderRadius:5,fontSize:9}}>
                        <span style={{color:'#fbbf24'}}>◆</span>
                        <span style={{fontWeight:700,color:'#f0f4f8'}}>${b?.token ?? '—'}</span>
                        <span style={{color:'#22c55e'}}>{b?.amount ?? ''}</span>
                        <span style={{marginLeft:'auto',color:'#f59e0b',fontWeight:700}}>{b?.minutesBefore ?? 0}min early</span>
                        <button type="button" onClick={e => openSwap(e, b?.token ?? '', b?.mint ?? '')} style={N.btn('#22c55e')}>⚡ BUY</button>
                        <button type="button" onClick={e => scanBefore(e, b?.mint ?? '')} style={N.btn('#a78bfa')}>🧠 SCAN</button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* ── ACTIVITY FEED (skeleton until first RPC poll completes) ── */}
        <div style={{background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,padding:'12px 16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',color:'rgba(255,255,255,0.25)'}}>RECENT SMART MONEY ACTIVITY</span>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <div style={{width:5,height:5,borderRadius:'50%',background:feedPollReady ? '#22c55e' : 'rgba(148,163,184,0.5)',animation: feedPollReady ? 'ping 1.5s ease-in-out infinite' : 'none'}}/>
                <span style={{fontSize:8,color:feedPollReady ? 'rgba(255,255,255,0.35)' : 'rgba(148,163,184,0.6)'}}>{feedPollReady ? 'LIVE' : 'CONNECTING'}</span>
              </div>
              <span style={{fontSize:7,color:'rgba(148,163,184,0.55)'}}>via /api/solana/rpc</span>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:0}}>
            {!feedPollReady ? (
              <>
                {Array.from({ length: 6 }).map((_, i) => <ActivitySkeletonRow key={i} i={i} />)}
              </>
            ) : (
              (displayFeed ?? []).map((a, i) => (
                <div key={`${a?.wallet ?? i}-${a?.time ?? i}`} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:i < (displayFeed?.length ?? 0) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',fontSize:10}}>
                  <span style={{color:a?.color ?? '#94a3b8',fontWeight:700,background:`${a?.color ?? '#64748b'}12`,padding:'2px 7px',borderRadius:3,fontSize:8,width:40,textAlign:'center',flexShrink:0}}>{a?.action ?? '—'}</span>
                  <span style={{color:'rgba(255,255,255,0.3)',flexShrink:0,fontSize:9}}>{a?.wallet ?? '—'}</span>
                  <span style={{fontWeight:700,color:'#f0f4f8',flexShrink:0}}>${a?.token ?? '—'}</span>
                  <span style={{color:'#a78bfa',flexShrink:0}}>{a?.amount ?? ''}</span>
                  {a?.insider ? <span style={{fontSize:8,color:'#fbbf24',flexShrink:0}}>◆</span> : null}
                  <span style={{marginLeft:'auto',color:'rgba(255,255,255,0.2)',fontSize:9,flexShrink:0}}>{a?.time ?? ''}</span>
                  {(a?.action ?? '') === 'BUY' || (a?.action ?? '') === 'POOL' ? (
                    <button type="button" onClick={e => openSwap(e, a?.token ?? '', a?.mint ?? '')} style={{...N.btn('#22c55e'),flexShrink:0}}>⚡ BUY</button>
                  ) : null}
                  <button type="button" onClick={e => scanBefore(e, a?.mint ?? '')} style={{...N.btn('#a78bfa'),flexShrink:0}}>🧠 SCAN</button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </>
  )
}

const InsiderWhaleIntel = memo(InsiderWhaleIntelImpl)
export default InsiderWhaleIntel
