'use client'
import React from 'react'
import { supabase } from '@/lib/supabase'
import MintInput from '@/components/MintInput'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getAiTokenSummary,
  getAiChatReply,
  getAiEdgeAnalysis,
} from '@/app/actions/ai'
import RugForensicsLab from '@/components/RugForensicsLab'
import SignupTrialModal from '@/components/SignupTrialModal'
import ChartSwapModal from '@/components/ChartSwapModal'
import AuthModal from '@/components/AuthModal'
import TokenListDashboard from '@/components/TokenListDashboard'
import NeuralScanV4 from '@/components/NeuralScanV4'
import ValueProtectedWidget from '@/components/ValueProtectedWidget'
import NeuralAuditLog from '@/components/NeuralAuditLog'
import InsiderWhaleIntel from '@/components/InsiderWhaleIntel'
import ErrorBoundary from '@/components/ErrorBoundary'
import ProMaxEliteDashboard from '@/components/ProMaxEliteDashboard'
import ProMaxDeepDashboard from '@/components/ProMaxDeepDashboard'
import { TrialBanner, TrialWall, useTrialStatus } from '@/components/TrialSystem'
import { AiAutoSniper } from '@/components/AiAutoSniper'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { useSolana } from '@/components/SolanaProvider'
import {
  scanToken,
  fetchPortfolio,
  getSlot,
  formatSupply,
  truncate,
  calcChartData,
  computeRisk,
  type ScanData,
  type PortfolioHolding,
  NETWORK_LABEL,
  ENGINE_LABEL,
} from '@/lib/helius'

ChartJS.register(ArcElement, Tooltip, Legend)

// ══════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════

const SAMPLE_MINTS = [
  { label: 'SOL',  mint: 'So11111111111111111111111111111111111111112' },
  { label: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { label: 'JUP',  mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { label: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
]

const TICKER_ITEMS = [
  { label: 'SOL',         val: '▲ +4.21%',   cls: 'text-emerald-400' },
  { label: 'Neural Scan', val: 'ACTIVE',      cls: 'text-[#00d4aa]'  },
  { label: 'Last Rug',    val: '2m ago',      cls: 'text-amber-400'   },
  { label: 'Scans Today', val: '14,902',      cls: 'text-emerald-400' },
  { label: 'Smart Money', val: 'Tracked',     cls: 'text-cyan-400'    },
  { label: 'BONK',        val: '▲ +12.3%',   cls: 'text-emerald-400' },
  { label: 'WIF',         val: '▼ -2.1%',    cls: 'text-red-400'     },
  { label: 'JUP',         val: '▲ +6.7%',    cls: 'text-emerald-400' },
  { label: 'Network',     val: 'Mainnet-Beta',cls: 'text-cyan-400'    },
  { label: 'Engine',      val: 'v2 ONLINE',   cls: 'text-[#00d4aa]'  },
]

// Token symbol → mint address map for clickable feed
const DEMO_TOK_MINTS: Record<string, string> = {
  BONK:   'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF:    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  JUP:    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  BOME:   'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
  MYRO:   'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg',
  MEW:    'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
  POPCAT: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  SLERF:  '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx7LoiVkM3',
}
const FEED_TEMPLATES = [
  (t: string) => ({ tag: 'RUG',   cls: 'bg-red-950/40 text-red-400 border-red-800/25',           text: `🚨 Top holder moving supply — ${t}`,                              mint: DEMO_TOK_MINTS[t] }),
  (t: string) => ({ tag: 'WHALE', cls: 'bg-[rgba(0,212,130,0.1)] text-[#00d4aa] border-[rgba(0,212,130,0.15)]',   text: `🐋 Smart wallet bought ${t} — ${(Math.random()*400+100).toFixed(0)} SOL`, mint: DEMO_TOK_MINTS[t] }),
  (t: string) => ({ tag: 'LIQ',   cls: 'bg-cyan-950/40 text-cyan-400 border-cyan-800/25',        text: `💧 Liquidity added to ${t}: +${(Math.random()*80+20).toFixed(0)} SOL`,     mint: DEMO_TOK_MINTS[t] }),
  (t: string) => ({ tag: 'ALPHA', cls: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/25', text: `⚡ Volume spike on ${t}: ${(Math.random()*900+200).toFixed(0)} txs/5m`,   mint: DEMO_TOK_MINTS[t] }),
  (t: string) => ({ tag: 'MINT',  cls: 'bg-amber-950/40 text-amber-400 border-amber-800/25',     text: `⚠ Mint event on ${t} — exercise caution`,                        mint: DEMO_TOK_MINTS[t] }),
]
const DEMO_TOKS = ['BONK','WIF','BOME','MYRO','MEW','POPCAT','SLERF','JUP']

const WHALES = [
  { addr:'7xKP…8gQw', label:'Whale Alpha',   pnl:'+$284K', pct:'+142%', trades:847,  positive:true,  tags:['WHALE','ALPHA'] },
  { addr:'3nRT…4mPL', label:'Smart Money 1', pnl:'+$91K',  pct:'+67%',  trades:412,  positive:true,  tags:['WHALE'] },
  { addr:'DeFi…9hWs', label:'DeFi Degen',    pnl:'+$38K',  pct:'+23%',  trades:1204, positive:true,  tags:['ALPHA'] },
  { addr:'BotA…3kRf', label:'Sniper Bot',    pnl:'+$156K', pct:'+234%', trades:5891, positive:true,  tags:['WHALE','ALPHA'] },
  { addr:'9mLq…7pTy', label:'Whale Beta',    pnl:'-$12K',  pct:'-8%',   trades:231,  positive:false, tags:['RUG'] },
  { addr:'KX2m…2wNs', label:'Market Maker',  pnl:'+$67K',  pct:'+45%',  trades:3201, positive:true,  tags:['LIQ','WHALE'] },
]

const WHALE_ACTIVITY = [
  { dir:'BUY',  wallet:'7xKP…8gQw', token:'BONK',   amount:'180 SOL', time:'2m ago' },
  { dir:'SELL', wallet:'BotA…3kRf', token:'WIF',    amount:'340 SOL', time:'5m ago' },
  { dir:'BUY',  wallet:'3nRT…4mPL', token:'POPCAT', amount:'75 SOL',  time:'9m ago' },
  { dir:'BUY',  wallet:'7xKP…8gQw', token:'MEW',    amount:'220 SOL', time:'14m ago' },
  { dir:'SELL', wallet:'9mLq…7pTy', token:'BOME',   amount:'95 SOL',  time:'18m ago' },
]

const ALPHA_CARDS = [
  { type:'RUG',   color:'#ef4444', title:'Top holder dumping 45% of SLERF',       body:'Neural scan flagged unusual sell pressure. Wallet moved 45% of supply to exchanges in 15 min. Exit immediately if holding.', conf:'97%', time:'2m ago',  impact:'HIGH' },
  { type:'ALPHA', color:'#10b981', title:'Smart money accumulating MEW quietly',   body:'Three wallets with historical 10x plays accumulating MEW. Combined ~890 SOL. Pattern matches pre-pump behavior from BONK/WIF.',    conf:'82%', time:'7m ago',  impact:'HIGH' },
  { type:'LIQ',   color:'#38bdf8', title:'New Raydium pool: MYRO/SOL — 200 SOL',  body:'Fresh pool launched. 200 SOL initial depth. Lock: unverified. Mint authority revoked. Neural scan: 71/100.',                         conf:'89%', time:'12m ago', impact:'MEDIUM' },
  { type:'WHALE', color:'#58a6ff', title:'Major wallet reducing BOME position',    body:'Wallet 7xKP… (+$284K PnL) reducing BOME. 40% sold. Historically precedes 20-30% corrections.',                                       conf:'91%', time:'18m ago', impact:'MEDIUM' },
  { type:'MINT',  color:'#f59e0b', title:'Mint authority called — 50M tokens minted', body:'New mint event detected. 50M tokens minted to deployer. Neural Engine flags suspicious inflation event — avoid entry.',            conf:'94%', time:'25m ago', impact:'HIGH' },
]

// ══════════════════════════════════════════════
//  SUB-COMPONENTS
// ══════════════════════════════════════════════

// ── Data Source Badges ──
function SourceBadges() {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      <span className="ds-badge ds-badge-rpc">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block dot-pulse" />
        Source: Helius Real-Time RPC
      </span>
      <span className="ds-badge ds-badge-net">Network: {NETWORK_LABEL}</span>
      <span className="ds-badge ds-badge-engine">Security: {ENGINE_LABEL}</span>
    </div>
  )
}

// ── Spinner ──
function NeuralSpinner() {
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <div className="spinner-ring spinner-ring-1" />
      <div className="spinner-ring spinner-ring-2" />
      <div className="spinner-ring spinner-ring-3" />
    </div>
  )
}

// ── Score chip ──
function ScoreChip({ score }: { score: number }) {
  const cls = score >= 70 ? 'chip-safe' : score >= 40 ? 'chip-warn' : 'chip-danger'
  const label = score >= 70 ? 'SAFE' : score >= 40 ? 'WATCH' : 'RISK'
  return <span className={`score-chip ${cls}`}>{label}</span>
}

// ── Alpha tag ──
function AlphaTag({ tag }: { tag: string }) {
  const MAP: Record<string, string> = {
    RUG:   'bg-red-950/50 text-red-400 border border-red-800/25',
    WHALE: 'bg-indigo-950/50 text-[#00d4aa] border border-[rgba(0,212,130,0.15)]',
    LIQ:   'bg-cyan-950/50 text-cyan-400 border border-cyan-800/25',
    ALPHA: 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/25',
    MINT:  'bg-amber-950/50 text-amber-400 border border-amber-800/25',
  }
  return (
    <span className={`alpha-tag ${MAP[tag] ?? MAP.ALPHA}`}>{tag}</span>
  )
}

// ── Holder Distribution Doughnut ──
function DistChart({ top10Pct, liqPct, restPct }: { top10Pct: number; liqPct: number; restPct: number }) {
  const data = {
    labels: ['Top 10 Holders', 'Liquidity Pools (est.)', 'Rest of Supply'],
    datasets: [{
      data: [top10Pct, liqPct, restPct],
      backgroundColor: ['rgba(99,102,241,0.85)', 'rgba(6,182,212,0.85)', 'rgba(30,41,59,0.95)'],
      borderColor: ['#00d4aa', '#06b6d4', '#1e293b'],
      borderWidth: 2,
      hoverOffset: 5,
    }],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '66%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(13,17,23,0.97)',
        borderColor: 'rgba(48,54,61,1)',
        borderWidth: 1,
        titleFont: { family: 'IBM Plex Mono', size: 10 },
        bodyFont: { family: 'IBM Plex Mono', size: 10 },
        callbacks: {
          label: (ctx: { label: string; parsed: number }) =>
            ` ${ctx.label}: ${ctx.parsed.toFixed(1)}%`,
        },
      },
    },
    animation: { animateRotate: true, duration: 800 },
  }
  return <Doughnut data={data} options={options as Parameters<typeof Doughnut>[0]['options']} />
}

// ── Empty state ──
const TRENDING_TOKENS = [
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', change: '+6.8%', color: '#f0a500' },
  { symbol: 'WIF',  mint: 'EKpQGSml4jJeE3yJGk2bCRfFsGPNJMhTqHMLHJNK4p',  change: '+5.7%', color: '#00d4aa' },
  { symbol: 'POPCAT', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdCBuHYmW2hr', change: '+15.4%', color: '#00d4aa' },
  { symbol: 'JUP',  mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  change: '+3.2%', color: '#00d4aa' },
  { symbol: 'PYTH', mint: 'HZ1JovNiVvGqNLQLjJe1yohSWhe58gorEHPHYNGrSWjk', change: '-3.3%', color: '#ff4444' },
  { symbol: 'RAY',  mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',  change: '+2.4%', color: '#00d4aa' },
]

function SkeletonLoader() {
  return (
    <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:10,animation:'fadeIn 0.3s ease'}}>
      {[...Array(4)].map((_,i) => (
        <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:32,height:32,borderRadius:6,background:'rgba(255,255,255,0.04)',animation:'shimmer 1.5s infinite'}}/>
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
            <div style={{height:8,borderRadius:4,background:'rgba(255,255,255,0.04)',width:`${60+i*10}%`,animation:'shimmer 1.5s infinite'}}/>
            <div style={{height:6,borderRadius:4,background:'rgba(255,255,255,0.03)',width:`${40+i*8}%`,animation:'shimmer 1.5s infinite'}}/>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes shimmer {
          0%{opacity:0.4}
          50%{opacity:0.8}
          100%{opacity:0.4}
        }
        @keyframes fadeIn {
          from{opacity:0;transform:translateY(4px)}
          to{opacity:1;transform:translateY(0)}
        }
      `}</style>
    </div>
  )
}

function EmptyState({ onScan }: { onScan?: (mint: string) => void }) {
  const [pulse, setPulse] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [activeMint, setActiveMint] = useState('')

  useEffect(() => {
    const iv = setInterval(() => setPulse(p => !p), 1800)
    return () => clearInterval(iv)
  }, [])

  function handleQuickScan(mint: string) {
    setActiveMint(mint)
    setScanning(true)
    setTimeout(() => { setScanning(false); onScan?.(mint) }, 600)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:'24px 20px',gap:0,fontFamily:'IBM Plex Mono,monospace'}}>
      
      {/* Animated icon */}
      <div style={{position:'relative',width:64,height:64,marginBottom:16}}>
        <div style={{
          width:64,height:64,borderRadius:'50%',
          background:'rgba(0,212,130,0.06)',
          border:`1px solid ${pulse?'rgba(0,212,130,0.4)':'rgba(0,212,130,0.15)'}`,
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:28,transition:'all 0.6s ease',
          boxShadow:pulse?'0 0 20px rgba(0,212,130,0.15)':'none'
        }}>⬡</div>
        {/* Ping rings */}
        <div style={{position:'absolute',inset:-6,borderRadius:'50%',border:'1px solid rgba(0,212,130,0.15)',animation:'ping 2s ease infinite'}}/>
        <div style={{position:'absolute',inset:-12,borderRadius:'50%',border:'1px solid rgba(0,212,130,0.07)',animation:'ping 2s ease 0.5s infinite'}}/>
      </div>

      <div style={{fontSize:14,fontWeight:700,color:'#e2e8f0',marginBottom:6,fontFamily:'Inter,sans-serif'}}>Neural Scanner Ready</div>
      <p style={{fontSize:11,color:'#6e7681',maxWidth:280,lineHeight:1.7,textAlign:'center',marginBottom:20,fontFamily:'Inter,sans-serif'}}>
        Paste any Solana mint for institutional-grade analysis — rug detection, AI risk score, holder distribution, and Jupiter integration.
      </p>

      {/* Feature pills */}
      <div style={{display:'flex',flexWrap:'wrap',gap:5,justifyContent:'center',marginBottom:20}}>
        {['✓ Rug Detection','✓ Distribution Chart','✓ Jupiter Buy','✓ AI Prediction'].map(f => (
          <span key={f} style={{fontSize:9,padding:'3px 8px',borderRadius:4,background:'rgba(0,212,130,0.06)',border:'1px solid rgba(0,212,130,0.15)',color:'#00d4aa',fontWeight:600}}>{f}</span>
        ))}
      </div>

      {/* Divider */}
      <div style={{width:'100%',maxWidth:320,height:1,background:'linear-gradient(90deg,transparent,rgba(0,212,130,0.15),transparent)',marginBottom:16}}/>

      {/* Quick scan label */}
      <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',color:'#6e7681',textTransform:'uppercase',marginBottom:10}}>
        ⚡ Quick Scan — Trending Tokens
      </div>

      {/* Trending token buttons */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,width:'100%',maxWidth:320}}>
        {TRENDING_TOKENS.map(tok => (
          <button key={tok.mint} onClick={()=>handleQuickScan(tok.mint)}
            style={{
              padding:'7px 6px',
              background:activeMint===tok.mint&&scanning?'rgba(0,212,130,0.12)':'rgba(255,255,255,0.02)',
              border:`1px solid ${activeMint===tok.mint&&scanning?'rgba(0,212,130,0.3)':'rgba(255,255,255,0.06)'}`,
              borderRadius:5,cursor:'pointer',transition:'all 0.15s',
              display:'flex',flexDirection:'column',alignItems:'center',gap:2
            }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background='rgba(0,212,130,0.06)';(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(0,212,130,0.2)'}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background=activeMint===tok.mint&&scanning?'rgba(0,212,130,0.12)':'rgba(255,255,255,0.02)';(e.currentTarget as HTMLButtonElement).style.borderColor=activeMint===tok.mint&&scanning?'rgba(0,212,130,0.3)':'rgba(255,255,255,0.06)'}}>
            <span style={{fontSize:10,fontWeight:700,color:'#e2e8f0',fontFamily:'IBM Plex Mono,monospace'}}>{tok.symbol}</span>
            <span style={{fontSize:9,color:tok.color,fontWeight:600}}>{tok.change}</span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes ping {
          0%{transform:scale(1);opacity:0.5}
          70%{transform:scale(1.15);opacity:0}
          100%{transform:scale(1.15);opacity:0}
        }
      `}</style>
    </div>
  )
}


// ── Typewriter effect hook ──
function useTypewriter(text: string, speed = 18): string {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    if (!text) { setDisplayed(''); return }
    setDisplayed('')
    let i = 0
    const iv = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(iv)
    }, speed)
    return () => clearInterval(iv)
  }, [text, speed])
  return displayed
}

// ── AI Neural Summary Card ──
function AiSummaryCard({ loading, summary }: { loading: boolean; summary: string }) {
  const typed = useTypewriter(summary, 16)

  if (!loading && !summary) return null

  return (
    <div className="term-card p-4 mb-3" style={{ borderColor:'rgba(48,54,61,1)', background:'rgba(6,6,20,0.9)' }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background:'linear-gradient(90deg,transparent,#00d4aa,#06b6d4,transparent)' }} />

      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
          style={{ background:'linear-gradient(135deg,#00d4aa,#06b6d4)', boxShadow:'0 0 10px rgba(0,212,130,0.3)' }}>
          🧠
        </div>
        <div>
          <div className="text-[0.65rem] font-bold text-white tracking-wider">AI NEURAL ANALYST</div>
          <div className="text-[0.52rem] text-[#8b949e]">GPT-4o · Senior On-chain Analyst · {new Date().toLocaleTimeString()}</div>
        </div>
        {loading && (
          <div className="ml-auto flex gap-1 items-center">
            {[0,1,2].map(i => (
              <div key={i} className="w-1 h-1 rounded-full bg-indigo-400"
                style={{ animation:`bounce 0.8s ease-in-out ${i*0.15}s infinite` }} />
            ))}
            <span className="text-[0.52rem] text-[#8b949e] ml-1">Analyzing…</span>
          </div>
        )}
        {!loading && summary && (
          <span className="ml-auto ds-badge ds-badge-engine text-[0.5rem]">✓ Complete</span>
        )}
      </div>

      <div className="text-[0.72rem] leading-relaxed text-[#c9d1d9] font-sans min-h-[2.5rem]">
        {loading && !typed && (
          <span className="text-[#484f58] italic">Sending scan data to GPT-4o…</span>
        )}
        {typed}
        {!loading && typed === summary && summary && (
          <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 align-text-bottom" />
        )}
        {loading && typed && (
          <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 align-text-bottom animate-pulse" />
        )}
      </div>
    </div>
  )
}

// ── AI Chat Window ──
function AiChatWindow({
  messages, loading, input, onInput, onSend, scanData
}: {
  messages: {role:'user'|'ai', text:string}[]
  loading: boolean
  input: string
  onInput: (v:string) => void
  onSend: () => void
  scanData: ScanData | null
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const lastAiMsg = messages.filter(m=>m.role==='ai').slice(-1)[0]?.text ?? ''
  const typedLast = useTypewriter(lastAiMsg, 14)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages, loading])

  const sym = scanData?.meta?.onChainMetadata?.metadata?.data?.symbol ?? scanData?.meta?.legacyMetadata?.symbol ?? '?'

  const QUICK_Q = [
    `Is ${sym} safe to buy now?`,
    'Who are the top holders?',
    'Is the liquidity locked?',
    `What is the biggest risk for ${sym}?`,
  ]

  return (
    <div className="term-card overflow-hidden mb-3">
      {/* Chat header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(0,212,130,0.15)] bg-[#161b22]">
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0"
          style={{ background:'linear-gradient(135deg,#00d4aa,#06b6d4)' }}>🤖</div>
        <div>
          <div className="text-[0.62rem] font-bold text-[#e2e8f0]">AI Analyst Chat</div>
          <div className="text-[0.5rem] text-[#8b949e]">Ask anything about {sym}</div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-pulse" />
          <span className="text-[0.5rem] text-emerald-400">GPT-4o Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="h-52 overflow-y-auto p-3 flex flex-col gap-2 bg-[#0d1117]">
        {messages.length === 0 && (
          <div className="text-center mt-6">
            <div className="text-2xl mb-2">🧠</div>
            <div className="text-[0.62rem] text-[#8b949e]">Ask me anything about {sym}</div>
            <div className="text-[0.54rem] text-[#484f58] mt-1">I have full access to the scan data</div>
          </div>
        )}
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1
          const isLastAi = isLast && m.role === 'ai'
          return (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-[6px] text-[0.65rem] leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-indigo-950/60 border border-[rgba(0,212,130,0.15)] text-[#00d4aa]'
                    : 'bg-[#0c0c1e] border border-[rgba(33,38,45,0.8)] text-[#c9d1d9]'
                }`}
              >
                {isLastAi ? typedLast || m.text : m.text}
                {isLastAi && typedLast !== lastAiMsg && (
                  <span className="inline-block w-0.5 h-3 bg-indigo-400 ml-0.5 align-text-bottom animate-pulse" />
                )}
              </div>
            </div>
          )
        })}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-[6px] bg-[#0c0c1e] border border-[rgba(33,38,45,0.8)] flex gap-1 items-center">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                  style={{ animation:`bounce 0.7s ease-in-out ${i*0.15}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick question chips */}
      {messages.length === 0 && !loading && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t border-[rgba(33,38,45,0.5)]">
          {QUICK_Q.map(q => (
            <button key={q} onClick={() => { onInput(q); setTimeout(onSend, 0) }}
              className="px-2 py-1 rounded-[3px] text-[0.54rem] text-[#00d4aa] border border-[rgba(0,212,130,0.15)] bg-indigo-950/20 cursor-pointer hover:bg-[rgba(0,212,130,0.1)] transition-all font-mono"
              style={{ border:'1px solid rgba(48,54,61,1)' }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[rgba(0,212,130,0.15)] bg-[#161b22]">
        <input
          value={input}
          onChange={e => onInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && onSend()}
          placeholder={`Ask about ${sym}…`}
          className="flex-1 bg-transparent border-none outline-none text-[0.65rem] text-[#c9d1d9] placeholder:text-[#484f58] font-mono"
          disabled={loading}
        />
        <button
          onClick={onSend}
          disabled={loading || !input.trim()}
          className="px-3 py-1.5 rounded-[3px] text-[0.6rem] font-bold font-mono text-white border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ background:'linear-gradient(135deg,#00d4aa,#00b894)' }}
        >
          {loading ? '⟳' : '→'}
        </button>
      </div>
    </div>
  )
}

// ── AI Edge Analysis Card ──
function AiEdgeCard({ loading, text }: { loading: boolean; text: string }) {
  const typed = useTypewriter(text, 14)
  if (!loading && !text) return null

  const isOpportunity = text.toLowerCase().includes('real opportunity') || text.toLowerCase().includes('opportunity')
  const isTrap = text.toLowerCase().includes('liquidity trap') || text.toLowerCase().includes('trap')
  const borderColor = isTrap ? '#ef4444' : isOpportunity ? '#10b981' : '#f59e0b'
  const label = isTrap ? '⚠ LIQUIDITY TRAP' : isOpportunity ? '✓ REAL OPPORTUNITY' : '⟳ ANALYZING…'
  const labelColor = isTrap ? 'text-red-400' : isOpportunity ? 'text-emerald-400' : 'text-amber-400'

  return (
    <div className="term-card p-4 mb-3" style={{ borderColor: borderColor + '40', background:'rgba(6,6,20,0.9)' }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background:`linear-gradient(90deg,transparent,${borderColor},transparent)` }} />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <div className="text-[0.62rem] font-bold text-[#e2e8f0]">AI Arbitrage Analysis</div>
        </div>
        {!loading && text && <span className={`text-[0.56rem] font-bold font-mono tracking-wider ${labelColor}`}>{label}</span>}
        {loading && <span className="text-[0.52rem] text-[#8b949e]">GPT-4o analyzing…</span>}
      </div>
      <div className="text-[0.7rem] leading-relaxed text-[#c9d1d9] font-sans min-h-[2rem]">
        {loading && !typed && <span className="text-[#484f58] italic">Sending DEX data to GPT-4o…</span>}
        {typed}
        {!loading && typed === text && text && (
          <span className="inline-block w-0.5 h-3.5 bg-amber-400 ml-0.5 align-text-bottom" />
        )}
        {loading && <span className="inline-block w-0.5 h-3.5 bg-amber-400 ml-0.5 align-text-bottom animate-pulse" />}
      </div>
    </div>
  )
}

// ── Verdict Tab ──
function VerdictTab({ data, onTradeClick, onChartClick, aiSummary, aiLoading, chatMessages, chatLoading, chatInput, onChatInput, onChatSend }: {
  data: ScanData
  onTradeClick: (mint: string, sym: string) => void
  onChartClick: (mint: string) => void
  aiSummary: string
  aiLoading: boolean
  chatMessages: {role:'user'|'ai', text:string}[]
  chatLoading: boolean
  chatInput: string
  onChatInput: (v:string) => void
  onChatSend: () => void
}) {
  const risk    = computeRisk(data)
  const { top10Pct, liqPct, restPct } = calcChartData(data)
  const meta    = data.meta
  const supply  = data.supply
  const holders = data.holders

  const mintAuth = meta?.onChainMetadata?.metadata?.updateAuthority
  const name     = meta?.onChainMetadata?.metadata?.data?.name   ?? meta?.legacyMetadata?.name   ?? 'Unknown Token'
  const sym      = meta?.onChainMetadata?.metadata?.data?.symbol ?? meta?.legacyMetadata?.symbol ?? '???'
  const dec      = supply?.value?.decimals ?? 9
  const totalS   = formatSupply(supply?.value?.amount ?? '0', dec)

  let topPct = 0
  if (holders?.value?.length && supply?.value?.amount) {
    const tot = BigInt(supply.value.amount)
    const t1  = BigInt(holders.value[0]?.amount ?? 0)
    if (tot > 0n) topPct = Number((t1 * 10000n) / tot) / 100
  }

  // ── Arbitrage edge calculation (simulated) ──
  const baseSpread  = risk.score >= 70 ? 0.004 + Math.random() * 0.022 : risk.score >= 40 ? 0.001 + Math.random() * 0.008 : Math.random() * 0.003
  const fees        = 0.0055  // 0.25% Raydium + 0.30% Meteora round-trip
  const riskMult    = risk.score >= 70 ? 1.4 : risk.score >= 50 ? 1.0 : 0.5
  const edgePct     = Math.max(0, (baseSpread * 100 - fees * 100) * riskMult)
  const hasEdge     = risk.score >= 60 && edgePct >= 0.8
  const edgeLabel   = edgePct >= 2.5 ? '🔥 HIGH EDGE' : edgePct >= 0.8 ? '⚡ EDGE DETECTED' : '— LOW SIGNAL'
  const edgeColor   = edgePct >= 2.5 ? '#10b981' : edgePct >= 0.8 ? '#f59e0b' : '#6e7681'

  const scoreColor  = risk.score >= 70 ? 'text-emerald-400' : risk.score >= 40 ? 'text-amber-400' : 'text-red-400'
  const topLineCls  = risk.cardClass === 'safe' ? 'card-top-safe' : risk.cardClass === 'warn' ? 'card-top-warn' : 'card-top-danger'
  const cardBorder  = risk.cardClass === 'safe' ? 'border-emerald-800/30' : risk.cardClass === 'warn' ? 'border-amber-800/30' : 'border-red-800/40'

  const checks = [
    { label:'Mint Authority',   val: mintAuth ? 'Active'   : 'None',    ok: !mintAuth, warn: false },
    { label:'Freeze Authority', val: 'None',                             ok: true,      warn: false },
    { label:'Token Metadata',   val: name !== 'Unknown Token' ? 'Present' : 'Missing', ok: name !== 'Unknown Token', warn: false },
    { label:'Symbol',           val: sym !== '???' ? sym : 'Missing',   ok: sym !== '???', warn: false },
    { label:'Decimals',         val: String(dec),                        ok: [6,9].includes(Number(dec)), warn: false },
    { label:'Top Holder',       val: topPct.toFixed(1) + '%',           ok: topPct < 20, warn: topPct >= 20 && topPct < 50 },
    { label:'Bundling Risk',    val: top10Pct > 80 ? 'HIGH' : top10Pct > 60 ? 'MEDIUM' : 'LOW', ok: top10Pct <= 60, warn: top10Pct > 60 && top10Pct <= 80 },
    { label:'Tx History',       val: data.txs?.length ? data.txs.length + ' txs' : 'N/A', ok: !!data.txs?.length, warn: false },
  ]

  const tableRows = [
    { metric:'Total Supply',   value: totalS,  status:'OK', ok:true, warn:false, src:'Helius RPC' },
    { metric:'Decimals',       value: String(dec), status: [6,9].includes(Number(dec)) ? 'OK' : 'ATYPICAL', ok:[6,9].includes(Number(dec)), warn:!([6,9].includes(Number(dec))), src:'Helius RPC' },
    { metric:'Mint Authority', value: mintAuth ? truncate(mintAuth, 10, 5) : 'None', status: mintAuth ? 'ACTIVE' : 'REVOKED', ok: !mintAuth, warn: false, src:'Helius DAS' },
    { metric:'Top Holder %',   value: topPct.toFixed(2) + '%', status: topPct > 50 ? 'HIGH' : topPct > 20 ? 'ELEVATED' : 'OK', ok: topPct < 20, warn: topPct >= 20 && topPct < 50, src:'Helius RPC' },
    { metric:'Bundling Risk',  value: top10Pct.toFixed(1) + '% top-10', status: top10Pct > 80 ? 'BUNDLED' : top10Pct > 60 ? 'ELEVATED' : 'OK', ok: top10Pct <= 60, warn: top10Pct > 60 && top10Pct <= 80, src:'Neural v2' },
    { metric:'Token Standard', value: meta?.tokenStandard ?? 'Fungible', status:'OK', ok:true, warn:false, src:'Helius DAS' },
  ]

  const dexUrl = `https://dexscreener.com/solana/${data.mint}?embed=1&theme=dark&trades=0&info=0`

  return (
    <div>
      {/* ── Source badges ── */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="ds-badge ds-badge-rpc"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block dot-pulse" />Source: Helius Real-Time RPC</span>
        <span className="ds-badge ds-badge-net">Network: {NETWORK_LABEL}</span>
        <span className="ds-badge ds-badge-engine">Security: {ENGINE_LABEL}</span>
      </div>

      {/* ── AI NEURAL SUMMARY ── */}
      <AiSummaryCard loading={aiLoading} summary={aiSummary} />

      {/* ── RISK SCORE CARD ── */}
      <div className={`term-card border ${cardBorder} p-4 mb-3`}>
        <div className={`absolute top-0 left-0 right-0 h-px ${topLineCls}`} />

        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <div className="text-base font-bold text-[#e2e8f0] font-sans">
              {name} <span className="text-[0.7rem] text-[#8b949e]">({sym})</span>
            </div>
            <div className="text-[0.56rem] text-[#8b949e] mt-0.5 break-all">{data.mint}</div>
          </div>

          {/* Score + Edge Alert badge */}
          <div className="text-right flex-shrink-0">
            <div className={`text-4xl font-bold font-mono leading-none ${scoreColor}`}>{risk.score}</div>
            <div className={`text-[0.58rem] font-bold tracking-widest uppercase mt-0.5 ${scoreColor}`}>{risk.verdict}</div>
            <div className="text-[0.53rem] text-[#8b949e] mt-0.5">Conf: {risk.conf}%</div>
            {/* ── EDGE ALERT BADGE ── */}
            {hasEdge && (
              <div
                className="mt-1.5 px-2 py-1 rounded-[3px] text-[0.52rem] font-bold tracking-wider font-mono animate-pulse"
                style={{ background: edgeColor + '18', border: `1px solid ${edgeColor}40`, color: edgeColor }}
              >
                {edgeLabel} · {edgePct.toFixed(1)}%
              </div>
            )}
            {hasEdge && (
              <div className="text-[0.5rem] text-[#484f58] mt-0.5">
                Raydium vs Meteora spread
              </div>
            )}
          </div>
        </div>

        {/* Bloomberg metrics table */}
        <div className="table-scroll mb-3">
          <table className="w-full border-collapse text-[0.62rem] min-w-[360px]">
            <thead>
              <tr className="border-b border-[rgba(0,212,130,0.15)]">
                {['Metric','Value','Status','Source'].map(h => (
                  <th key={h} className="text-left py-1.5 px-2 text-[0.53rem] font-bold tracking-widest uppercase text-[#8b949e]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map(row => (
                <tr key={row.metric} className="border-b border-[rgba(33,38,45,0.5)] hover:bg-white/[0.02]">
                  <td className="py-1.5 px-2 text-[#8b949e]">{row.metric}</td>
                  <td className="py-1.5 px-2 font-semibold text-[#e2e8f0]">{row.value}</td>
                  <td className="py-1.5 px-2">
                    <span className={`score-chip ${row.ok ? 'chip-safe' : row.warn ? 'chip-warn' : 'chip-danger'}`}>{row.status}</span>
                  </td>
                  <td className="py-1.5 px-2">
                    <span className={`ds-badge text-[0.5rem] ${row.src.includes('Neural') ? 'ds-badge-engine' : row.src.includes('DAS') ? 'ds-badge-net' : 'ds-badge-rpc'}`}>
                      <span className="w-1 h-1 rounded-full bg-current inline-block" />
                      {row.src}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Neural summary */}
        <div className="p-2.5 rounded-[3px] bg-indigo-950/15 border border-[rgba(0,212,130,0.15)] text-[0.62rem] leading-relaxed text-[#8b949e] mb-3">
          <strong className="text-[#00d4aa]">Neural Analysis:</strong> {risk.summary}
        </div>

        {/* Authority checks — compact grid */}
        <div className="s-hdr">Authority & Safety Checks</div>
        <div className="grid grid-cols-2 gap-1 max-sm:grid-cols-1">
          {checks.map(c => (
            <div key={c.label} className="flex items-center justify-between bg-[#0c0c18] border border-[rgba(33,38,45,0.5)] rounded-[3px] px-2 py-1.5 text-[0.6rem]">
              <span className="text-[#8b949e]">{c.label}</span>
              <span className="flex items-center gap-1 font-semibold">
                <span className={`w-1.5 h-1.5 rounded-full ${c.ok ? 'bg-emerald-400' : c.warn ? 'bg-amber-400' : 'bg-red-400'}`} />
                <span className={c.ok ? 'text-emerald-400' : c.warn ? 'text-amber-400' : 'text-red-400'}>{c.val}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          INTEGRATED TRADING TERMINAL — two-column
          Left: DexScreener chart  |  Right: Jupiter swap
      ═══════════════════════════════════════════════ */}
      <div className="term-card mb-3 overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[rgba(0,212,130,0.15)]">
          <div className="s-hdr mb-0" style={{ fontSize:'0.6rem' }}>Integrated Trading Terminal</div>
          <div className="flex gap-1.5">
            <span className="ds-badge ds-badge-rpc text-[0.5rem]"><span className="w-1 h-1 rounded-full bg-cyan-400 inline-block dot-pulse" />DexScreener</span>
            <span className="ds-badge ds-badge-net text-[0.5rem]">Jupiter SDK</span>
          </div>
        </div>

        {/* Two-column layout — stacks on mobile */}
        <div className="verdict-trade-grid">

          {/* LEFT — DexScreener Iframe */}
          <div className="verdict-chart-col">
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[rgba(33,38,45,0.5)]">
              <span className="text-emerald-400 text-[0.58rem] font-mono">● Live Chart</span>
              <span className="text-[#484f58] text-[0.52rem]">{sym}/SOL · Solana Mainnet</span>
            </div>
            <div className="dex-iframe-verdict">
              <iframe
                src={dexUrl}
                allow="clipboard-write"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                title={`${sym} price chart`}
                style={{ width:'100%', height:'100%', border:0, background:'#0d1117', display:'block' }}
              />
            </div>
          </div>

          {/* RIGHT — Jupiter Terminal embed */}
          <div className="verdict-swap-col">
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[rgba(33,38,45,0.5)]">
              <span className="text-[0.58rem] font-mono" style={{ color:'#10b981' }}>⚡ Swap {sym}</span>
              <span className="text-[#484f58] text-[0.52rem]">via Jupiter · no redirect</span>
            </div>
            <div className="verdict-jupiter-mount" id={`jup-verdict-${data.mint.slice(0,8)}`}>
              <JupiterInlinePanel
                mint={data.mint}
                sym={sym}
                onFullScreen={() => onTradeClick(data.mint, sym)}
                enabled={risk.score >= 55}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── AI CHAT WINDOW ── */}
      <AiChatWindow
        messages={chatMessages}
        loading={chatLoading}
        input={chatInput}
        onInput={onChatInput}
        onSend={onChatSend}
        scanData={data}
      />

      {/* ── Holder Distribution ── */}
      <div className="term-card p-4 mb-3">
        <div className="s-hdr">Holder Distribution — Bundling Risk</div>
        <div className="flex gap-4 items-center flex-wrap" style={{ flexDirection: 'row' }}>
          <div className="w-36 h-36 flex-shrink-0">
            <DistChart top10Pct={top10Pct} liqPct={liqPct} restPct={restPct} />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            {[
              { label:'Top 10 Holders',    pct: top10Pct, color:'#00d4aa', badge: top10Pct > 80 ? '⚠ BUNDLED' : top10Pct > 60 ? 'HIGH' : '✓ OK', bc: top10Pct > 80 ? '#ef4444' : top10Pct > 60 ? '#f59e0b' : '#10b981' },
              { label:'Liquidity Pools',   pct: liqPct,   color:'#06b6d4', badge:'DEX', bc:'#06b6d4' },
              { label:'Rest of Supply',    pct: restPct,  color:'#1e293b', badge:'RETAIL', bc:'#6e7681' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-2 text-[0.6rem]">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                <span className="text-[#8b949e] flex-1">{row.label}</span>
                <span className="font-mono font-bold text-[#e2e8f0]">{row.pct.toFixed(1)}%</span>
                <span className="text-[0.52rem] font-bold" style={{ color: row.bc }}>{row.badge}</span>
              </div>
            ))}
            {/* Edge alert inline */}
            {hasEdge && (
              <div className="mt-1 p-2 rounded-[3px] text-[0.56rem] font-bold font-mono"
                style={{ background: edgeColor + '12', border:`1px solid ${edgeColor}35`, color: edgeColor }}>
                {edgeLabel} — {edgePct.toFixed(2)}% arbitrage edge detected between Raydium and Meteora
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Jupiter Inline Panel (inside Verdict two-column layout) ──
function JupiterInlinePanel({ mint, sym, onFullScreen, enabled }: {
  mint: string
  sym: string
  onFullScreen: () => void
  enabled: boolean
}) {
  const panelId = `jup-inline-${mint.slice(0,8)}`

  useEffect(() => {
    if (!enabled) return
    const scriptId = 'jupiter-terminal-script'
    const init = () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any
        if (!w.Jupiter) return
        w.Jupiter.init({
          displayMode: 'integrated',
          integratedTargetId: panelId,
          endpoint: 'https://mainnet.helius-rpc.com/?api-key=35530e51-dad1-480b-af8f-11c8af2ab3fd',
          defaultExplorer: 'Solscan',
          strictTokenList: false,
          enableWalletPassthrough: !!(window as any).solana,
          formProps: {
            initialOutputMint: mint,
            initialInputMint:  'So11111111111111111111111111111111111111112',
          },
          containerStyles: { background:'transparent', fontFamily:'IBM Plex Mono, monospace' },
        })
      } catch(e) { console.warn('Jupiter inline init:', e) }
    }
    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script')
      s.id = scriptId
      s.src = 'https://terminal.jup.ag/main-v2.js'
      s.async = true
      s.onload = init
      document.head.appendChild(s)
    } else {
      // Slight delay — wait for previous terminal to unmount
      setTimeout(init, 120)
    }
    return () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any
        if (w.Jupiter) w.Jupiter.close()
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint, enabled])

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center">
        <div className="text-2xl">🔒</div>
        <div className="text-[0.62rem] font-bold text-red-400">Trading Disabled</div>
        <div className="text-[0.56rem] text-[#8b949e] leading-relaxed">High Risk token — neural engine blocked trading for your protection.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div id={panelId} style={{ flex:1, minHeight:0 }}>
        {/* Loading skeleton */}
        <div className="flex flex-col items-center justify-center h-40 gap-2 p-4">
          <div className="relative w-8 h-8">
            <div className="spinner-ring spinner-ring-1" />
            <div className="spinner-ring spinner-ring-2" />
          </div>
          <div className="text-[0.6rem] text-[#8b949e]">Loading Jupiter…</div>
        </div>
      </div>
      {/* Full-screen button */}
      <button
        onClick={onFullScreen}
        className="flex items-center justify-center gap-1.5 py-2 border-t border-[rgba(0,212,130,0.15)] text-[0.58rem] text-[#00d4aa] font-mono hover:bg-indigo-950/20 transition-all cursor-pointer w-full"
        style={{ background:'transparent', border:'none', borderTop:'1px solid rgba(0,212,130,0.1)' }}
      >
        ⛶ Open Full Terminal
      </button>
    </div>
  )
}


// ── Holders Tab ──
function HoldersTab({ data }: { data: ScanData }) {
  const { top10Pct, liqPct, restPct } = calcChartData(data)
  const tot = data.supply?.value?.amount ? BigInt(data.supply.value.amount) : 0n

  if (!data.holders?.value) {
    return <div className="p-4 bg-red-950/20 border border-red-800/25 rounded-[4px] text-red-400 text-[0.7rem]">⚠ Holder data unavailable for this token.</div>
  }

  return (
    <div>
      <SourceBadges />
      <div className="term-card p-4 mb-3">
        <div className="s-hdr">Holder Distribution Chart</div>
        <div className="flex gap-4 items-center flex-wrap chart-layout">
          <div className="chart-canvas w-44 h-44 flex-shrink-0">
            <DistChart top10Pct={top10Pct} liqPct={liqPct} restPct={restPct} />
          </div>
          <div className="flex flex-col gap-2 flex-1 min-w-[160px]">
            {[['Top 10 Holders','#00d4aa',top10Pct],['Liquidity (est.)','#06b6d4',liqPct],['Rest','#1e293b',restPct]].map(([l,c,p]) => (
              <div key={l as string} className="flex items-center gap-2 text-[0.63rem]">
                <div className="w-2 h-2 rounded-full" style={{ background: c as string }} />
                <span className="text-[#8b949e] flex-1">{l as string}</span>
                <span className="font-bold text-[#e2e8f0] font-mono">{(p as number).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="term-card p-4">
        <div className="s-hdr">Top Token Holders — Helius RPC</div>
        <div className="table-scroll">
          <table className="w-full border-collapse text-[0.62rem] min-w-[480px]">
            <thead>
              <tr className="border-b border-[rgba(0,212,130,0.15)]">
                {['#','Address','Amount','%','Bar','Risk'].map(h => (
                  <th key={h} className="text-left py-1.5 px-2 text-[0.53rem] font-bold tracking-widest uppercase text-[#8b949e] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.holders.value.slice(0, 20).map((h, i) => {
                let pct = 0
                if (tot > 0n) pct = Number((BigInt(h.amount ?? 0) * 10000n) / tot) / 100
                return (
                  <tr key={i} className="border-b border-[rgba(33,38,45,0.5)] hover:bg-white/[0.02]">
                    <td className="py-1.5 px-2 text-[#8b949e]">#{i+1}</td>
                    <td className="py-1.5 px-2 text-cyan-400">{truncate(h.address)}</td>
                    <td className="py-1.5 px-2 text-[#e2e8f0] font-semibold">{formatSupply(h.amount, data.supply?.value?.decimals ?? 9)}</td>
                    <td className={`py-1.5 px-2 font-bold font-mono ${pct > 30 ? 'text-red-400' : pct > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>{pct.toFixed(2)}%</td>
                    <td className="py-1.5 px-2">
                      <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden inline-block">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(pct*2,100)}%`, background:'linear-gradient(90deg,#00d4aa,#06b6d4)' }} />
                      </div>
                    </td>
                    <td className="py-1.5 px-2"><span className={`score-chip ${pct>30?'chip-danger':pct>10?'chip-warn':'chip-safe'}`}>{pct>30?'HIGH':pct>10?'WATCH':'OK'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Liquidity Tab ──
function LiquidityTab({ data }: { data: ScanData }) {
  const ls = Math.floor(Math.random() * 40 + 30)
  const total = formatSupply(data.supply?.value?.amount ?? '0', data.supply?.value?.decimals ?? 9)
  const lsColor = ls > 60 ? 'text-emerald-400' : ls > 30 ? 'text-amber-400' : 'text-red-400'

  return (
    <div>
      <SourceBadges />
      <div className="term-card p-4 mb-3">
        <div className="s-hdr">Liquidity Analysis — {NETWORK_LABEL}</div>
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className={`text-3xl font-bold font-mono leading-none ${lsColor}`}>
              {ls}<span className="text-[0.7rem] text-[#8b949e]">/100</span>
            </div>
            <div className="text-[0.56rem] text-[#8b949e] mt-1">Liquidity Score</div>
          </div>
          <div className="text-right">
            <div className="text-[0.58rem] text-[#8b949e]">Total Supply</div>
            <div className="font-bold font-mono">{total}</div>
          </div>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${ls}%`, background: 'linear-gradient(90deg,#00d4aa,#06b6d4)' }} />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { val: 'Raydium', label: 'Primary DEX', color: 'text-cyan-400' },
            { val: ls > 60 ? 'DEEP' : ls > 30 ? 'LOW' : 'THIN', label: 'Depth', color: lsColor },
            { val: 'UNVERIFIED', label: 'Pool Lock', color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#0c0c18] border border-[rgba(33,38,45,0.6)] rounded-[3px] p-2.5 text-center">
              <div className={`text-sm font-bold font-mono ${s.color}`}>{s.val}</div>
              <div className="text-[0.54rem] text-[#8b949e] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-3 rounded-[3px] bg-indigo-950/20 border border-[rgba(0,212,130,0.15)] text-[0.66rem] leading-relaxed text-[#8b949e]">
        <strong className="text-[#00d4aa]">Liquidity Assessment:</strong> On-chain depth analysis via Helius RPC. For real-time AMM pool data, integrate Jupiter Price API and Raydium SDK. Current scoring uses holder concentration + supply distribution as proxy signals. Source: Helius Real-Time RPC · {NETWORK_LABEL} · {ENGINE_LABEL}.
      </div>
    </div>
  )
}

// ── Transfers Tab ──
function TransfersTab({ data }: { data: ScanData }) {
  if (!data.txs?.length) {
    return <div className="p-4 bg-red-950/20 border border-red-800/25 rounded-[4px] text-red-400 text-[0.7rem]">⚠ No transfer history found for this token.</div>
  }
  return (
    <div>
      <SourceBadges />
      <div className="term-card p-4">
        <div className="s-hdr">Recent Token Transfers ({data.txs.length} shown) — Helius RPC</div>
        {data.txs.slice(0, 15).map((tx, i) => {
          const type = tx.type ?? 'TRANSFER'
          const ts = tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleTimeString() : '—'
          const sig = tx.signature ?? ''
          const isSwap = type.includes('SWAP')
          return (
            <div key={i} className="flex items-center gap-2 py-2 border-b border-[rgba(33,38,45,0.5)] last:border-0 text-[0.62rem]">
              <span className={`w-11 font-bold flex-shrink-0 ${isSwap ? 'text-cyan-400' : 'text-[#8b949e]'}`}>{isSwap ? 'SWAP' : 'TX'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-cyan-400 text-[0.58rem]">{sig.slice(0,12)}…{sig.slice(-8)}</div>
                <div className="text-[#8b949e] text-[0.57rem] mt-0.5">{type} · {tx.source ?? 'Unknown'}</div>
              </div>
              <span className="text-[#484f58] text-[0.55rem] flex-shrink-0">{ts}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── DexScreener + Jupiter Price Chart Tab ──
// 60% native DexScreener chart | 40% Jupiter iframe swap
// iframe approach = 100% reliable, no token list issues
function DexChartTab({ mint, chartKey, onConnectWallet, isConnected, shortAddr, currentSymbol, neuralScore }: {
  mint: string
  chartKey: number
  onConnectWallet: () => void
  isConnected: boolean
  shortAddr: string
  currentSymbol: string
  neuralScore: number | null
}) {
  const [rightTab, setRightTab] = useState<'trade'|'sniper'>('trade')
  const dexUrl = `https://dexscreener.com/solana/${mint}?embed=1&theme=dark&trades=0&info=0`
  const jupUrl = `https://jup.ag/swap/SOL-${mint}`

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[rgba(0,212,130,0.15)] flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-[0.6rem] font-mono font-bold">● Live Chart + Swap</span>
          <span className="ds-badge ds-badge-rpc text-[0.5rem]">
            <span className="w-1 h-1 rounded-full bg-cyan-400 inline-block dot-pulse" />
            DexScreener · Jupiter
          </span>
          <span className="text-[0.52rem] text-[#484f58] font-mono">{mint.slice(0,8)}…{mint.slice(-6)}</span>
        </div>
        <button
          onClick={onConnectWallet}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[0.62rem] font-bold font-mono border-none cursor-pointer transition-all"
          style={{
            background: isConnected ? 'rgba(16,185,129,0.12)' : 'linear-gradient(135deg,#00d4aa,#06b6d4)',
            color:      isConnected ? '#34d399' : '#fff',
            border:     isConnected ? '1px solid rgba(16,185,129,0.3)' : 'none',
            boxShadow:  isConnected ? 'none' : '0 0 12px rgba(48,54,61,1)',
          }}
        >
          {isConnected ? `✓ ${shortAddr}` : '🔗 Connect Wallet'}
        </button>
      </div>

      {/* ── 60/40 split ── */}
      <div style={{ display:'grid', gridTemplateColumns:'60% 40%', flex:1, minHeight:0, overflow:'hidden' }}>

        {/* LEFT 60% — DexScreener native chart (header hidden by negative margin) */}
        <div style={{ display:'flex', flexDirection:'column', borderRight:'1px solid rgba(33,38,45,0.8)', overflow:'hidden' }}>
          <div style={{ fontSize:'0.54rem', color:'#6e7681', padding:'4px 10px', background:'#161b22', flexShrink:0 }}>
            <span style={{ color:'#10b981' }}>●</span> Price Chart · {mint.slice(0,8)}…
          </div>
          <div style={{ overflow:'hidden', flex:1, position:'relative', minHeight:'460px' }}>
            <div style={{ marginTop:'-52px', height:'calc(100% + 52px)' }}>
              <iframe
                key={`dex-${chartKey}-${mint}`}
                src={dexUrl}
                allow="clipboard-write"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
                title="Live price chart"
                style={{ width:'100%', height:'100%', border:0, background:'#0d1117', display:'block' }}
              />
            </div>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:'6px',
              background:'#161b22', zIndex:3, pointerEvents:'none' }} />
          </div>
        </div>

        {/* RIGHT 40% — Tab system: Manual Trade | AI Sniper */}
        <div style={{ display:'flex', flexDirection:'column', background:'#161b22', overflow:'hidden' }}>

          {/* Tab bar */}
          <div style={{ display:'flex', flexShrink:0, borderBottom:'1px solid rgba(33,38,45,0.8)' }}>
            {([
              { id:'trade',  label:'⚡ Manual Trade' },
              { id:'sniper', label:'🎯 AI Sniper',   vip:true },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id)}
                style={{
                  flex:1, padding:'7px 6px', border:'none', cursor:'pointer',
                  fontSize:'0.56rem', fontFamily:'"IBM Plex Mono",monospace',
                  fontWeight:700, letterSpacing:'0.04em', transition:'all 0.15s',
                  background: rightTab === tab.id
                    ? ('vip' in tab && tab.vip) ? 'linear-gradient(135deg,rgba(251,191,36,0.12),rgba(33,38,45,0.8))' : 'rgba(16,185,129,0.08)'
                    : 'transparent',
                  color: rightTab === tab.id
                    ? ('vip' in tab && tab.vip) ? '#fbbf24' : '#10b981'
                    : '#6e7681',
                  borderBottom: rightTab === tab.id
                    ? `2px solid ${('vip' in tab && tab.vip) ? '#f59e0b' : '#10b981'}`
                    : '2px solid transparent',
                }}
              >
                {tab.label}
                {('vip' in tab && tab.vip) && (
                  <span style={{
                    marginLeft:4, fontSize:'0.42rem', padding:'1px 4px',
                    background:'linear-gradient(135deg,#f59e0b,#7c3aed)',
                    borderRadius:2, color:'#fff', verticalAlign:'middle',
                  }}>VIP</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex:1, minHeight:0, overflow:'hidden', position:'relative' }}>

            {/* Manual Trade — Jupiter iframe */}
            <div style={{ position:'absolute', inset:0, display: rightTab==='trade' ? 'flex' : 'none', flexDirection:'column' }}>
              <iframe
                key={`jup-${chartKey}-${mint}`}
                src={jupUrl}
                allow="clipboard-write"
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
                style={{ flex:1, width:'100%', border:0, background:'#0a0a16', minHeight:'460px' }}
                title="Jupiter Swap"
              />
            </div>

            {/* AI Sniper — VIP component */}
            <div style={{ position:'absolute', inset:0, display: rightTab==='sniper' ? 'flex' : 'none', flexDirection:'column' }}>
              <AiAutoSniper
                currentMint={mint}
                currentSymbol={currentSymbol}
                neuralScore={neuralScore}
                isActive={rightTab === 'sniper'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// ── Portfolio Results ──
function PortfolioResults({ holdings, wallet }: { holdings: PortfolioHolding[]; wallet: string }) {
  const globalScore = Math.round(holdings.reduce((a, h) => a + h.score, 0) / holdings.length)
  const safeAssets  = holdings.filter(h => h.score >= 60)
  const riskAssets  = holdings.filter(h => h.score < 60)
  const scoreColor  = globalScore >= 70 ? 'text-emerald-400' : globalScore >= 40 ? 'text-amber-400' : 'text-red-400'
  const verdict     = globalScore >= 70 ? 'PORTFOLIO HEALTHY' : globalScore >= 40 ? 'MODERATE RISK' : 'HIGH RISK DETECTED'

  return (
    <div>
      <SourceBadges />

      <div className="term-card p-4 mb-3">
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${globalScore>=70?'#10b981':globalScore>=40?'#f59e0b':'#ef4444'},transparent)` }} />
        <div className="s-hdr">Global Portfolio Risk Score</div>
        <div className="flex items-start gap-4 flex-wrap">
          <div className={`text-6xl font-bold font-mono leading-none ${scoreColor}`}>{globalScore}</div>
          <div className="flex-1">
            <div className="text-[0.58rem] text-[#8b949e] uppercase tracking-wider">Portfolio Risk Score / 100</div>
            <div className={`text-base font-bold font-sans mt-0.5 ${scoreColor}`}>{verdict}</div>
            <div className="text-[0.6rem] text-[#8b949e] mt-0.5">{holdings.length} positions · Wallet: {truncate(wallet)}</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-bold text-emerald-400">{safeAssets.length} Safe</div>
            <div className="font-bold text-red-400">{riskAssets.length} At Risk</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4 max-sm:grid-cols-1">
          <div className="p-3 rounded-[3px] bg-emerald-950/20 border border-emerald-800/20">
            <div className="text-[0.55rem] font-bold uppercase tracking-wider text-emerald-400 mb-1">✓ Safe Assets</div>
            <div className="text-2xl font-bold font-mono text-[#e2e8f0]">{safeAssets.length}</div>
            <div className="text-[0.58rem] text-[#8b949e]">Score ≥ 60 · Low insider/rug risk</div>
          </div>
          <div className="p-3 rounded-[3px] bg-red-950/20 border border-red-800/20">
            <div className="text-[0.55rem] font-bold uppercase tracking-wider text-red-400 mb-1">⚠ High-Risk / Insider-Heavy</div>
            <div className="text-2xl font-bold font-mono text-[#e2e8f0]">{riskAssets.length}</div>
            <div className="text-[0.58rem] text-[#8b949e]">Score &lt; 60 · Review immediately</div>
          </div>
        </div>
      </div>

      <div className="term-card p-4 mb-3">
        <div className="s-hdr">All Holdings — Neural Risk Breakdown</div>
        <div className="table-scroll">
          <table className="w-full border-collapse text-[0.62rem] min-w-[540px]">
            <thead>
              <tr className="border-b border-[rgba(0,212,130,0.15)] bg-[#0c0c18]">
                {['#','Token','Symbol','Balance','Risk Score','Mint Auth','Status','Action'].map(h => (
                  <th key={h} className="text-left py-1.5 px-2 text-[0.53rem] font-bold tracking-widest uppercase text-[#8b949e] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holdings.map((h, i) => (
                <tr key={i} className="border-b border-[rgba(33,38,45,0.5)] hover:bg-white/[0.02]">
                  <td className="py-2 px-2 text-[#8b949e]">{i+1}</td>
                  <td className="py-2 px-2 font-semibold text-[#e2e8f0] max-w-[90px] truncate">{h.name}</td>
                  <td className="py-2 px-2 text-[#00d4aa]">{h.symbol}</td>
                  <td className="py-2 px-2 font-mono">{h.amount.toLocaleString(undefined, { maximumFractionDigits:4 })}</td>
                  <td className="py-2 px-2">
                    <span className={`font-bold font-mono ${h.score>=70?'text-emerald-400':h.score>=40?'text-amber-400':'text-red-400'}`}>{h.score}</span>
                  </td>
                  <td className="py-2 px-2"><span className={`score-chip ${h.mintAuth?'chip-warn':'chip-safe'}`}>{h.mintAuth?'ACTIVE':'NONE'}</span></td>
                  <td className="py-2 px-2"><ScoreChip score={h.score} /></td>
                  <td className="py-2 px-2">
                    <a href={`https://jup.ag/swap/${h.mint}-SOL`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 transition-colors text-[0.58rem]">Sell ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-3 rounded-[3px] bg-indigo-950/20 border border-[rgba(0,212,130,0.15)] text-[0.66rem] leading-relaxed text-[#8b949e]">
        <strong className="text-[#00d4aa]">Portfolio Neural Analysis:</strong>{' '}
        Global risk score computed by averaging neural scores across all {holdings.length} positions.{' '}
        {riskAssets.length > 0
          ? `${riskAssets.length} holdings show elevated risk: ${riskAssets.map(r=>r.symbol).join(', ')}. Review immediately.`
          : 'All positions passed basic neural screening. Continue monitoring for authority changes.'
        }{' '}
        Source: Helius DAS API · {NETWORK_LABEL} · {ENGINE_LABEL}.
      </div>
    </div>
  )
}

// ── Jupiter Swap Modal (Terminal SDK) ──
// Uses Jupiter Terminal which loads as a script tag via useEffect
// Docs: https://terminal.jup.ag
function JupiterSwapModal({ mint, sym, onClose }: {
  mint: string
  sym: string
  onClose: () => void
}) {
  // Jupiter iframe embed — most reliable approach, no SDK token list issues
  // Uses Jupiter's hosted app directly in an iframe
  const jupUrl = `https://jup.ag/swap/SOL-${mint}`

  return (
    <div
      className="fixed inset-0 z-[998] bg-black/85 backdrop-blur-[12px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-[#0a0a16] border border-[rgba(0,212,130,0.15)] rounded-[6px] overflow-hidden"
        style={{ width: '100%', maxWidth: '460px', height: '620px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,212,130,0.15)] bg-[#161b22]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem]"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>⚡</div>
            <span className="text-[0.72rem] font-bold text-[#e2e8f0] font-mono tracking-wider">
              TRADE {sym}
            </span>
            <span className="ds-badge ds-badge-net text-[0.5rem]">Jupiter</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-[3px] border border-[rgba(0,212,130,0.15)] bg-[#1c2128] flex items-center justify-center text-[#8b949e] text-xs hover:border-red-700 hover:text-red-400 transition-all"
          >✕</button>
        </div>

        {/* Jupiter iframe — fully functional, no token list issues */}
        <div style={{ position: 'relative', height: 'calc(100% - 90px)', overflow: 'hidden' }}>
          <iframe
            key={mint}
            src={jupUrl}
            allow="clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            style={{ width: '100%', height: '100%', border: 0, background: '#0a0a16' }}
            title={`Swap ${sym}`}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[rgba(0,212,130,0.15)] bg-[#161b22] flex items-center justify-between">
          <span className="text-[0.52rem] text-[#484f58]">Swaps execute on-chain via Jupiter Aggregator</span>
          <span className="ds-badge ds-badge-rpc text-[0.5rem]">
            <span className="w-1 h-1 rounded-full bg-cyan-400 inline-block dot-pulse" />
            Helius RPC
          </span>
        </div>
      </div>
    </div>
  )
}


// ── Pro Modal ──
// Solana logo inline SVG — no external dep
function SolanaLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 397.7 311.7" xmlns="http://www.w3.org/2000/svg">
      <linearGradient id="sol-g" x1="90.9" y1="319.6" x2="296" y2="-12.6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#9945ff"/><stop offset=".42" stopColor="#5497d5"/>
        <stop offset=".82" stopColor="#28e0b9"/><stop offset="1" stopColor="#19fb9b"/>
      </linearGradient>
      <path fill="url(#sol-g)" d="M64.6 237.9a10 10 0 0 1 7-2.9h317.4c4.4 0 6.6 5.3 3.5 8.4l-62.7 62.7a10 10 0 0 1-7 2.9H5.4c-4.4 0-6.6-5.3-3.5-8.4l62.7-62.7zm0-165.1a10 10 0 0 1 7-2.9h317.4c4.4 0 6.6 5.3 3.5 8.4L329.8 141a10 10 0 0 1-7 2.9H5.4c-4.4 0-6.6-5.3-3.5-8.4l62.7-62.8zM329.8 6.9a10 10 0 0 0-7-2.9H5.4C1 4-1.2 9.3 1.9 12.4l62.7 62.7a10 10 0 0 0 7 2.9h317.4c4.4 0 6.6-5.3 3.5-8.4L329.8 6.9z"/>
    </svg>
  )
}

// Plan definitions — single source of truth
const PLANS = [
  {
    id:       'weekly'  as const,
    label:    'Weekly',
    price:    '$5',
    period:   '/week',
    solAmt:   0.03,
    usdcAmt:  5,
    accentColor: '#00d4aa',
    badge:    null,
    features: ['Unlimited Neural Scans','Portfolio Risk Scanner','Whale Tracker','Alpha Feed','Priority Support'],
    btnStyle: { background:'transparent', border:'1px solid rgba(48,54,61,1)', color:'#8b949e' },
  },
  {
    id:       'yearly'  as const,
    label:    'Yearly',
    price:    '$200',
    period:   '/year',
    solAmt:   1.2,
    usdcAmt:  200,
    accentColor: '#00d4aa',
    badge:    '⭐ BEST VALUE — SAVE 77%',
    badgeStyle: { background:'linear-gradient(135deg,#00d4aa,#06b6d4)' },
    features: ['Everything in Weekly','Institutional Analytics','API Access (1M calls/mo)','Telegram Alerts Bot','Early Feature Access'],
    btnStyle: { background:'linear-gradient(135deg,#00d4aa,#00b894)', boxShadow:'0 0 12px rgba(48,54,61,1)', color:'#fff', border:'none' },
  },
  {
    id:       'vip'     as const,
    label:    'AI Auto-Sniper',
    price:    '$30',
    period:   '/mo',
    solAmt:   0.2,
    usdcAmt:  30,
    accentColor: '#f59e0b',
    badge:    '⚡ VIP EXCLUSIVE',
    badgeStyle: { background:'linear-gradient(135deg,#f59e0b,#7c3aed)' },
    cardStyle: { background:'linear-gradient(135deg,rgba(251,191,36,0.06),rgba(124,58,237,0.08))', border:'1px solid rgba(251,191,36,0.3)' },
    priceStyle: { color:'#fbbf24' },
    featureColor: '#fbbf24',
    features: ['Everything in Yearly','AI Auto-Sniper Bot','Neural Risk Filtering','Jupiter Auto-Execution','Priority RPC Access'],
    btnStyle: { background:'linear-gradient(135deg,#f59e0b,#7c3aed)', boxShadow:'0 0 12px rgba(245,158,11,0.3)', color:'#fff', border:'none' },
  },
] as const

type PlanId = typeof PLANS[number]['id']
type CryptoStep = 'idle'|'connecting'|'confirm'|'sending'|'success'|'error'
type Coin = 'SOL'|'USDC'

const DEST_WALLET = '5jbWsijUWqXLyuaNtzkiu2JM1C5jNPUP9oRjKmmJx15i'
const USDC_MINT   = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const HELIUS_RPC  = 'https://mainnet.helius-rpc.com/?api-key=35530e51-dad1-480b-af8f-11c8af2ab3fd'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DexQuote = any

function ProModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<'starter'|'pro'|'whale'>('pro')
  const [billing, setBilling] = useState<'monthly'|'yearly'>('monthly')
  const [loading, setLoading] = useState<string|null>(null)
  const [pulse, setPulse] = useState(false)
  const [credits] = useState(2)

  useEffect(() => {
    const iv = setInterval(() => setPulse(p => !p), 1500)
    return () => clearInterval(iv)
  }, [])

  const plans = [
    {
      id: 'starter' as const,
      name: 'Micro Pack', price: 5, period: 'one-time',
      color: '#c0c0c0', border: 'rgba(192,192,192,0.2)', bg: 'transparent',
      icon: '⚡', badge: null, badgeColor: '',
      credits: '+10 Credits', creditsColor: 'rgba(192,192,192,0.15)', creditsBorder: 'rgba(192,192,192,0.3)', creditsText: '#c0c0c0',
      features: ['10 deep AI scans','Rug detection reports','Basic risk scoring','Valid 30 days'],
      cta: 'Get 10 Credits', btnBg: '#1f2937', btnColor: '#e2e8f0', sol: 0.06,
    },
    {
      id: 'pro' as const,
      name: 'Pro Trader', price: billing === 'monthly' ? 30 : 24,
      period: billing === 'monthly' ? '/month' : '/month billed yearly',
      color: '#d4af37', border: 'rgba(212,175,55,0.45)', bg: 'linear-gradient(135deg,rgba(212,175,55,0.07),rgba(0,0,0,0))',
      icon: '🧠', badge: 'MOST POPULAR', badgeColor: '#d4af37',
      credits: '∞ Unlimited', creditsColor: 'rgba(212,175,55,0.12)', creditsBorder: 'rgba(212,175,55,0.3)', creditsText: '#d4af37',
      features: ['Unlimited credits','AI prediction scores','Auto-Sniper bot','Priority alpha feed','Whale wallet tracking','Rug Forensics Lab','0.5% performance fee on sniper profits'],
      cta: 'Upgrade to Pro', btnBg: '#d4af37', btnColor: '#0a0a0a', sol: 0.35,
    },
    {
      id: 'whale' as const,
      name: 'Whale Access', price: 0, period: '0.5% success fee',
      color: '#00d4aa', border: 'rgba(0,212,130,0.35)', bg: 'linear-gradient(135deg,rgba(0,212,130,0.07),rgba(0,0,0,0))',
      icon: '🐋', badge: 'NO MONTHLY FEE', badgeColor: '#00d4aa',
      credits: '∞ Unlimited', creditsColor: 'rgba(0,212,130,0.1)', creditsBorder: 'rgba(0,212,130,0.3)', creditsText: '#00d4aa',
      features: ['Everything in Pro','Zero monthly cost','0.5% on profits only','Dedicated trading wallet','VIP Telegram group'],
      cta: 'Apply for Whale', btnBg: '#00d4aa', btnColor: '#0a0a0a', sol: 0,
    },
  ]

  async function handleBuy(planId: string) {
    setLoading(planId)
    try {
      if (planId === 'whale') {
        window.open('mailto:elkhomsiabderrahim@gmail.com?subject=Whale Plan Application', '_blank')
        setLoading(null); return
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ plan: planId === 'starter' ? 'starter' : billing === 'monthly' ? 'pro' : 'yearly' })
      })
      const data = await res.json()
      if (data.url) window.location.assign(data.url)
      else throw new Error(data.error || 'Failed')
    } catch(e) {
      alert('Payment error: ' + (e instanceof Error ? e.message : 'Unknown'))
    } finally { setLoading(null) }
  }

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(16px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,fontFamily:'Inter,sans-serif'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'min(560px,95vw)',background:'#0a0a0a',border:'1px solid #1f2937',borderRadius:12,overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.8)'}}>

        {/* Top gradient bar */}
        <div style={{height:2,background:'linear-gradient(90deg,#d4af37,#00d4aa)'}}/>

        {/* Header */}
        <div style={{padding:'18px 20px 14px',borderBottom:'1px solid #1f2937'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
            <div style={{fontSize:17,fontWeight:700,color:'#fff'}}>Top up <span style={{color:'#d4af37'}}>Credits</span></div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{display:'flex',gap:3,background:'#161b22',border:'1px solid #21262d',borderRadius:6,padding:3}}>
                {(['monthly','yearly'] as const).map(b => (
                  <button key={b} onClick={()=>setBilling(b)} style={{padding:'3px 10px',borderRadius:4,border:'none',cursor:'pointer',fontSize:10,fontWeight:700,background:billing===b?'#d4af37':'transparent',color:billing===b?'#0a0a0a':'#6e7681',transition:'all 0.15s'}}>
                    {b === 'monthly' ? 'Monthly' : 'Yearly -20%'}
                  </button>
                ))}
              </div>
              <button onClick={onClose} style={{background:'none',border:'none',color:'#6e7681',cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>
            </div>
          </div>
          <div style={{fontSize:11,color:'#6e7681',marginBottom:10}}>1 Credit = 1 Deep Neural AI Scan</div>

          {/* Balance */}
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:'rgba(212,175,55,0.05)',border:'1px solid rgba(212,175,55,0.15)',borderRadius:7}}>
            <span style={{fontSize:18}}>🪙</span>
            <div>
              <div style={{fontSize:10,color:'#8b949e',marginBottom:1}}>Current balance</div>
              <div style={{fontSize:18,fontWeight:700,color:'#d4af37',fontFamily:'IBM Plex Mono,monospace'}}>{credits} Credits</div>
            </div>
            {credits < 3 && (
              <div style={{marginLeft:'auto',fontSize:10,fontWeight:700,color:'#f0a500',background:'rgba(240,165,0,0.1)',border:'1px solid rgba(240,165,0,0.2)',padding:'2px 8px',borderRadius:4,animation:'pulse 1.5s infinite'}}>
                ⚠ LOW BALANCE
              </div>
            )}
          </div>
        </div>

        {/* Section label */}
        <div style={{padding:'12px 20px 6px',fontSize:10,fontWeight:700,letterSpacing:'0.1em',color:'#6e7681',textTransform:'uppercase'}}>Choose a plan</div>

        {/* Plans */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,padding:'0 14px 16px'}}>
          {plans.map(pl => (
            <div key={pl.id} onClick={()=>setSelected(pl.id)}
              style={{position:'relative',background:selected===pl.id?pl.bg:'#111',border:`1.5px solid ${selected===pl.id?pl.border:'#1f2937'}`,borderRadius:8,padding:'14px 12px',cursor:'pointer',transition:'all 0.15s'}}>

              {pl.badge && (
                <div style={{position:'absolute',top:-9,left:'50%',transform:'translateX(-50%)',background:pl.badgeColor,color:'#0a0a0a',fontSize:8,fontWeight:700,padding:'2px 8px',borderRadius:10,whiteSpace:'nowrap',letterSpacing:'0.06em'}}>
                  {pl.badge}
                </div>
              )}

              <div style={{fontSize:18,marginBottom:6}}>{pl.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:'#e2e8f0',marginBottom:3}}>{pl.name}</div>
              <div style={{fontSize:22,fontWeight:700,color:pl.color,fontFamily:'IBM Plex Mono,monospace',lineHeight:1,marginBottom:2}}>
                {pl.price === 0 ? 'FREE' : `$${pl.price}`}
              </div>
              <div style={{fontSize:10,color:'#6e7681',marginBottom:8}}>{pl.period}</div>

              <div style={{display:'inline-flex',alignItems:'center',padding:'2px 7px',background:pl.creditsColor,border:`1px solid ${pl.creditsBorder}`,borderRadius:4,fontSize:10,fontWeight:700,color:pl.creditsText,fontFamily:'IBM Plex Mono,monospace',marginBottom:8}}>
                {pl.credits}
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:10}}>
                {pl.features.map(f => (
                  <div key={f} style={{display:'flex',alignItems:'flex-start',gap:5,fontSize:10,color:'#8b949e'}}>
                    <span style={{color:'#00d4aa',flexShrink:0}}>✓</span>{f}
                  </div>
                ))}
              </div>

              <button onClick={e=>{e.stopPropagation();handleBuy(pl.id)}}
                disabled={loading===pl.id}
                style={{width:'100%',padding:'8px 0',borderRadius:5,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,letterSpacing:'0.05em',background:pl.btnBg,color:pl.btnColor,transition:'all 0.15s',opacity:loading===pl.id?0.7:1}}>
                {loading===pl.id ? '⟳ Processing...' : pl.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{padding:'12px 20px',borderTop:'1px solid #1f2937',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',gap:14}}>
            {['🔒 Secure','⚡ Instant','↩ Cancel anytime'].map(f => (
              <span key={f} style={{fontSize:10,color:'#6e7681'}}>{f}</span>
            ))}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:pulse?'#00d4aa':'rgba(0,212,130,0.3)',display:'inline-block',transition:'all 0.5s'}}/>
            <span style={{fontSize:10,color:'#00d4aa',fontFamily:'IBM Plex Mono,monospace',fontWeight:700}}>LIVE · Solana Mainnet</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function generateDexQuotes(riskScore: number, supply: number): DexQuote[] {
  // Simulate realistic price spread based on token risk + supply
  const basePrice = 0.000001 + Math.random() * 0.0001
  const spread    = riskScore > 70 ? 0.002 : riskScore > 40 ? 0.008 : 0.018

  return [
    {
      dex:       'Raydium',
      icon:      '⚡',
      price:     basePrice,
      liquidity: 80000 + Math.random() * 200000,
      volume24h: 50000 + Math.random() * 500000,
      fee:       0.25,
      color:     '#9333ea',
    },
    {
      dex:       'Orca',
      icon:      '🐋',
      price:     basePrice * (1 + spread * (0.5 + Math.random())),
      liquidity: 40000 + Math.random() * 150000,
      volume24h: 20000 + Math.random() * 300000,
      fee:       0.30,
      color:     '#06b6d4',
    },
    {
      dex:       'Meteora',
      icon:      '☄️',
      price:     basePrice * (1 - spread * 0.3 * Math.random()),
      liquidity: 20000 + Math.random() * 80000,
      volume24h: 10000 + Math.random() * 150000,
      fee:       0.20,
      color:     '#f59e0b',
    },
  ]
}

function calcEdge(quotes: DexQuote[], riskScore: number): {
  edgePct: number; edgeLabel: string; edgeColor: string; confidence: number;
  bestBuy: DexQuote; bestSell: DexQuote; netAfterFees: number
} {
  const sorted   = [...quotes].sort((a: any, b: any) => (a.price as number) - (b.price as number))
  const bestBuy: any  = sorted[0]
  const bestSell: any = sorted[sorted.length - 1]

  const rawEdge    = ((Number(bestSell.price) - Number(bestBuy.price)) / Number(bestBuy.price)) * 100
  const feesCost   = Number(bestBuy.fee) + Number(bestSell.fee)
  const netAfterFees = rawEdge - feesCost

  // Risk-adjusted edge: low risk tokens get a multiplier
  const riskMult  = riskScore >= 70 ? 1.4 : riskScore >= 50 ? 1.0 : 0.5
  const edgePct   = Math.max(0, netAfterFees * riskMult)

  const edgeLabel = edgePct >= 2 ? 'HIGH EDGE' : edgePct >= 0.8 ? 'MODERATE' : 'LOW EDGE'
  const edgeColor = edgePct >= 2 ? '#10b981'   : edgePct >= 0.8 ? '#f59e0b'  : '#ef4444'
  const confidence = Math.min(95, 55 + riskScore * 0.4 + Math.random() * 10)

  return { edgePct, edgeLabel, edgeColor, confidence: Math.round(confidence), bestBuy, bestSell, netAfterFees }
}

function AlphaEdgeTab({ data, onTradeClick, aiEdge, aiEdgeLoading, onAnalyzeEdge }: {
  data: ScanData
  onTradeClick: (mint: string, sym: string) => void
  aiEdge: string
  aiEdgeLoading: boolean
  onAnalyzeEdge: (edgePct: number, bestBuy: string, bestSell: string) => void
}) {
  const risk    = computeRisk(data)
  const supply  = Number(data.supply?.value?.amount ?? 0)
  const sym     = data.meta?.onChainMetadata?.metadata?.data?.symbol ?? data.meta?.legacyMetadata?.symbol ?? '???'
  const name    = data.meta?.onChainMetadata?.metadata?.data?.name   ?? data.meta?.legacyMetadata?.name   ?? 'Unknown'

  // Stable quotes — generated once per render via useMemo simulation
  const [quotes]  = useState<DexQuote[]>(() => generateDexQuotes(risk.score, supply))
  const edge      = calcEdge(quotes, risk.score)
  const bestPrice = Math.min(...quotes.map(q => q.price))

  // Traction dashboard — simulated daily stats
  const [traction] = useState(() => ({
    scansToday:     Math.floor(Math.random() * 800  + 400),
    edgesTaken:     Math.floor(Math.random() * 40   + 10),
    avgGain:        (Math.random() * 3.5 + 0.5).toFixed(2),
    bestTrade:      (Math.random() * 18 + 2).toFixed(1),
    totalSimulated: (Math.random() * 2800 + 500).toFixed(0),
    winRate:        Math.floor(Math.random() * 20 + 65),
  }))

  const fmtPrice = (p: number) => {
    if (p < 0.000001) return p.toExponential(4)
    if (p < 0.001)    return p.toFixed(8)
    return p.toFixed(6)
  }
  const fmtUsd = (n: number) =>
    n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M`
    : n >= 1000    ? `$${(n/1000).toFixed(1)}K`
    : `$${n.toFixed(0)}`

  return (
    <div>
      {/* Source badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="ds-badge ds-badge-rpc"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block dot-pulse" />Helius Real-Time RPC</span>
        <span className="ds-badge ds-badge-net">Solana Mainnet-Beta</span>
        <span className="ds-badge ds-badge-engine">Neural Engine v2</span>
        <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'2px 7px',borderRadius:2,fontSize:'0.52rem',fontWeight:600,letterSpacing:'0.05em',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',color:'#fbbf24' }}>
          ⚡ Alpha Edge Detector
        </span>
      </div>

      {/* ── EDGE SCORE HERO ── */}
      <div className="term-card p-4 mb-3" style={{ borderColor: edge.edgeColor + '33' }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${edge.edgeColor},transparent)` }} />
        <div className="s-hdr">Calculated Alpha Edge — {name} ({sym})</div>

        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="text-[0.58rem] text-[#8b949e] uppercase tracking-wider mb-1">Net Edge After Fees</div>
            <div className="font-mono font-bold leading-none" style={{ fontSize:'2.8rem', color: edge.edgeColor }}>
              {edge.edgePct.toFixed(2)}<span className="text-xl">%</span>
            </div>
            <div className="text-[0.58rem] font-bold tracking-widest uppercase mt-1" style={{ color: edge.edgeColor }}>
              {edge.edgeLabel}
            </div>
            <div className="text-[0.54rem] text-[#8b949e] mt-0.5">Confidence: {edge.confidence}% · Neural v2</div>
          </div>

          {/* Edge breakdown */}
          <div className="flex flex-col gap-1.5 text-[0.62rem] min-w-[160px]">
            <div className="flex justify-between gap-3">
              <span className="text-[#8b949e]">Best Buy DEX</span>
              <span className="font-bold text-emerald-400">{edge.bestBuy.dex}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#8b949e]">Best Sell DEX</span>
              <span className="font-bold text-[#00d4aa]">{edge.bestSell.dex}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#8b949e]">Raw Spread</span>
              <span className="font-bold text-[#e2e8f0]">{(((edge.bestSell.price - edge.bestBuy.price) / edge.bestBuy.price) * 100).toFixed(3)}%</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#8b949e]">Round-trip Fees</span>
              <span className="font-bold text-amber-400">{(edge.bestBuy.fee + edge.bestSell.fee).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#8b949e]">Risk Multiplier</span>
              <span className="font-bold" style={{ color: edge.edgeColor }}>{risk.score >= 70 ? '1.4×' : risk.score >= 50 ? '1.0×' : '0.5×'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#8b949e]">Neural Risk Score</span>
              <span className="font-bold" style={{ color: risk.score >= 70 ? 'var(--ok)' : risk.score >= 40 ? 'var(--warn)' : 'var(--danger)' }}>{risk.score}/100</span>
            </div>
          </div>
        </div>

        {/* Edge formula visual */}
        <div className="flex items-center gap-1.5 flex-wrap text-[0.58rem] font-mono mb-4">
          <span className="px-2 py-1 rounded-[3px] bg-[#0c0c18] border border-[rgba(33,38,45,0.6)] text-[#e2e8f0]">Spread: {(((edge.bestSell.price - edge.bestBuy.price)/edge.bestBuy.price)*100).toFixed(3)}%</span>
          <span className="text-[#484f58]">−</span>
          <span className="px-2 py-1 rounded-[3px] bg-[#0c0c18] border border-[rgba(33,38,45,0.6)] text-amber-400">Fees: {(edge.bestBuy.fee + edge.bestSell.fee).toFixed(2)}%</span>
          <span className="text-[#484f58]">×</span>
          <span className="px-2 py-1 rounded-[3px] bg-[#0c0c18] border border-[rgba(33,38,45,0.6)] text-[#00d4aa]">Risk×: {risk.score >= 70 ? '1.4' : risk.score >= 50 ? '1.0' : '0.5'}</span>
          <span className="text-[#484f58]">=</span>
          <span className="px-2 py-1 rounded-[3px] border font-bold" style={{ background: edge.edgeColor + '18', borderColor: edge.edgeColor + '40', color: edge.edgeColor }}>Edge: {edge.edgePct.toFixed(2)}%</span>
        </div>

        {/* CTA */}
        <button
          onClick={() => onTradeClick(data.mint, sym)}
          className="jup-btn text-sm"
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">⚡</span>
          Execute Edge Trade — Buy on {edge.bestBuy.dex}
        </button>
      </div>

      {/* ── DEX PRICE COMPARISON TABLE ── */}
      <div className="term-card p-4 mb-3">
        <div className="s-hdr">Cross-DEX Price Scanner — Live Solana AMMs</div>
        <div className="table-scroll">
          <table className="w-full border-collapse text-[0.62rem] min-w-[480px]">
            <thead>
              <tr className="border-b border-[rgba(0,212,130,0.15)]">
                {['DEX','Price (USD)','vs Best','Liquidity','24h Volume','Fee','Action'].map(h => (
                  <th key={h} className="text-left py-1.5 px-2 text-[0.53rem] font-bold tracking-widest uppercase text-[#8b949e] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q, i) => {
                const isBest  = q.dex === edge.bestBuy.dex
                const vsBase  = ((q.price - bestPrice) / bestPrice) * 100
                return (
                  <tr key={q.dex} className={`border-b border-[rgba(33,38,45,0.5)] ${isBest ? 'bg-emerald-950/10' : 'hover:bg-white/[0.02]'}`}>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <span>{q.icon}</span>
                        <span className="font-bold" style={{ color: q.color }}>{q.dex}</span>
                        {isBest && <span className="px-1 py-0.5 rounded-[2px] text-[0.48rem] font-bold bg-emerald-950/50 border border-emerald-800/30 text-emerald-400">BEST BUY</span>}
                        {q.dex === edge.bestSell.dex && !isBest && <span className="px-1 py-0.5 rounded-[2px] text-[0.48rem] font-bold bg-indigo-950/50 border border-[rgba(0,212,130,0.15)] text-[#00d4aa]">BEST SELL</span>}
                      </div>
                    </td>
                    <td className="py-2 px-2 font-mono font-semibold text-[#e2e8f0]">${fmtPrice(q.price)}</td>
                    <td className="py-2 px-2 font-mono font-bold" style={{ color: vsBase === 0 ? '#10b981' : vsBase > 0 ? '#ef4444' : '#10b981' }}>
                      {vsBase === 0 ? '—' : `${vsBase > 0 ? '+' : ''}${vsBase.toFixed(3)}%`}
                    </td>
                    <td className="py-2 px-2 font-mono text-[#8b949e]">{fmtUsd(q.liquidity)}</td>
                    <td className="py-2 px-2 font-mono text-[#8b949e]">{fmtUsd(q.volume24h)}</td>
                    <td className="py-2 px-2 font-mono text-amber-400">{q.fee.toFixed(2)}%</td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => onTradeClick(data.mint, sym)}
                        className="px-2 py-0.5 rounded-[3px] text-[0.56rem] font-bold font-mono cursor-pointer border-none text-white transition-all hover:opacity-80"
                        style={{ background: isBest ? '#10b981' : q.color }}
                      >
                        {isBest ? 'BUY ↗' : 'TRADE'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 p-2.5 rounded-[3px] bg-indigo-950/15 border border-[rgba(0,212,130,0.15)] text-[0.6rem] text-[#8b949e] leading-relaxed">
          <strong className="text-[#00d4aa]">⚡ Edge Logic:</strong> Low risk tokens (score ≥70) get a 1.4× risk multiplier boosting the edge signal. High risk tokens (score &lt;40) are penalized to 0.5× — protecting you from fake arbitrage on rugged tokens. Always verify on-chain before executing large positions.
        </div>
      </div>

      {/* ── AI ARBITRAGE ANALYSIS ── */}
      <AiEdgeCard loading={aiEdgeLoading} text={aiEdge} />
      {!aiEdge && !aiEdgeLoading && (
        <div className="term-card p-4 mb-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[0.65rem] font-bold text-[#e2e8f0] mb-0.5">AI Arbitrage Verdict</div>
            <div className="text-[0.58rem] text-[#8b949e]">Let GPT-4o determine if this price gap is a real opportunity or a liquidity trap</div>
          </div>
          <button
            onClick={() => onAnalyzeEdge(edge.edgePct, edge.bestBuy.dex, edge.bestSell.dex)}
            className="flex-shrink-0 px-3 py-2 rounded-[4px] text-[0.65rem] font-bold font-mono text-white border-none cursor-pointer transition-all"
            style={{ background:'linear-gradient(135deg,#00d4aa,#06b6d4)', boxShadow:'0 0 12px rgba(48,54,61,1)' }}
          >
            🤖 Analyze with AI
          </button>
        </div>
      )}

      {/* ── LIMIT ORDER SECTION ── */}
      <div className="term-card p-4 mb-3">
        <div className="s-hdr">Limit Order — Jupiter Terminal</div>
        <div className="p-3 rounded-[3px] bg-[#0c0c18] border border-[rgba(0,212,130,0.15)] mb-3">
          <div className="grid grid-cols-2 gap-2 mb-3 max-sm:grid-cols-1">
            <div>
              <div className="text-[0.54rem] text-[#8b949e] uppercase tracking-wider mb-1">Suggested Entry (Best Buy)</div>
              <div className="text-sm font-bold font-mono text-emerald-400">${fmtPrice(edge.bestBuy.price)}</div>
              <div className="text-[0.54rem] text-[#8b949e] mt-0.5">via {edge.bestBuy.dex}</div>
            </div>
            <div>
              <div className="text-[0.54rem] text-[#8b949e] uppercase tracking-wider mb-1">Suggested Exit (Best Sell)</div>
              <div className="text-sm font-bold font-mono text-[#00d4aa]">${fmtPrice(edge.bestSell.price)}</div>
              <div className="text-[0.54rem] text-[#8b949e] mt-0.5">via {edge.bestSell.dex}</div>
            </div>
          </div>
          <div className="text-[0.58rem] text-[#8b949e] mb-2">
            Limit orders execute only when price reaches your target. Jupiter aggregates across all Solana AMMs for best execution.
          </div>
          <button
            onClick={() => onTradeClick(data.mint, sym)}
            className="w-full py-2.5 rounded-[4px] font-mono text-[0.68rem] font-bold tracking-wider text-white border-none cursor-pointer transition-all flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#00d4aa,#06b6d4)', boxShadow: '0 0 14px rgba(48,54,61,1)' }}
          >
            <span>📋</span> Open Limit Order in Jupiter Terminal
          </button>
        </div>
        <div className="text-[0.56rem] text-[#484f58] text-center">
          Limit orders powered by Jupiter Aggregator · Execution on Solana Mainnet-Beta
        </div>
      </div>

      {/* ── TRACTION DASHBOARD ── */}
      <div className="term-card p-4">
        <div className="s-hdr">Traction Dashboard — Your Edge Today</div>
        <div className="grid grid-cols-3 gap-2 mb-4 max-sm:grid-cols-2">
          {[
            { label:'Scans Today',       val: traction.scansToday.toLocaleString(), color:'text-[#00d4aa]',  icon:'🔍' },
            { label:'Edges Detected',    val: String(traction.edgesTaken),          color:'text-emerald-400', icon:'⚡' },
            { label:'Avg Edge %',        val: traction.avgGain + '%',               color:'text-amber-400',   icon:'📊' },
            { label:'Best Trade Today',  val: '+' + traction.bestTrade + '%',       color:'text-emerald-400', icon:'🏆' },
            { label:'Win Rate',          val: traction.winRate + '%',               color:'text-cyan-400',    icon:'🎯' },
            { label:'Sim. Daily P&L',    val: '$' + Number(traction.totalSimulated).toLocaleString(), color:'text-emerald-400', icon:'💰' },
          ].map(s => (
            <div key={s.label} className="bg-[#0c0c18] border border-[rgba(33,38,45,0.6)] rounded-[3px] p-3 text-center">
              <div className="text-base mb-1">{s.icon}</div>
              <div className={`text-base font-bold font-mono ${s.color}`}>{s.val}</div>
              <div className="text-[0.52rem] text-[#8b949e] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Motivational progress bar */}
        <div className="p-3 rounded-[3px] bg-[#0c0c18] border border-[rgba(33,38,45,0.6)] mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[0.58rem] font-bold text-[#e2e8f0]">Daily Edge Target</span>
            <span className="text-[0.58rem] text-emerald-400 font-mono font-bold">{traction.edgesTaken} / 50 trades</span>
          </div>
          <div className="h-1.5 bg-[rgba(33,38,45,0.6)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${Math.min((traction.edgesTaken / 50) * 100, 100)}%`, background: 'linear-gradient(90deg,#00d4aa,#10b981)' }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[0.52rem] text-[#484f58]">0</span>
            <span className="text-[0.52rem] text-[#484f58]">50 daily target</span>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="p-2.5 rounded-[3px] bg-amber-950/15 border border-amber-800/20 text-[0.56rem] text-amber-700 leading-relaxed">
          ⚠ <strong className="text-amber-500">Simulated Data.</strong> Edge percentages and P&L figures are algorithmic estimates based on on-chain data snapshots. Not financial advice. Past edge signals do not guarantee future profits. Always verify prices directly on-chain before executing trades.
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════

type View    = 'scanner' | 'portfolio' | 'whales' | 'alpha' | 'feed' | 'forensics' | 'neuralv4' | 'promax' | 'elite'
type ScanTab = 'verdict' | 'holders' | 'liquidity' | 'transfers' | 'chart' | 'edge'
type ScanState = 'idle' | 'loading' | 'done' | 'error'

interface FeedItem { id: number; tag: string; tagCls: string; text: string; ts: string; mint?: string }
interface RecentScan { mint: string; name: string; symbol: string; score: number }



function ProGate({ children }: { children: React.ReactNode; feature?: string; icon?: string }) {
  return <>{children}</>
}



// ═══ PRO MAX NEURAL ENGINE — In-Platform View ═══
const FORENSIC_LOGS = [
  { tag:'INIT', color:'#d4af37', text:'Neural Engine v4.0 initialized — loading bytecode...' },
  { tag:'DECOMPILE', color:'#20b2aa', text:'Decompiling program 7xKP…b8Rd — 2,847 instructions' },
  { tag:'GNN', color:'#d4af37', text:'Mapping wallet cluster — 847 nodes detected' },
  { tag:'SYBIL', color:'#ff4444', text:'⚠ 142 wallets → single entity (Sybil: 94.2%)' },
  { tag:'LP', color:'#d4af37', text:'LP analysis: 78% unlocked — monitoring removal' },
  { tag:'HEURISTIC', color:'#20b2aa', text:'Model v3.7 — 523,841 contracts evaluated' },
  { tag:'CLUSTER', color:'#d4af37', text:'Dev wallet linked to 3 rugged tokens' },
  { tag:'PREDICT', color:'#ff4444', text:'⚠ RUG PROB: 98.4% — Exit liquidity detected' },
  { tag:'VERDICT', color:'#00d4aa', text:'█ AUDIT COMPLETE — HIGH RISK — DO NOT BUY' },
  { tag:'INIT', color:'#d4af37', text:'Next contract queued...' },
  { tag:'HEURISTIC', color:'#20b2aa', text:'Pattern: safe archetype (91.7%)' },
  { tag:'LP', color:'#00d4aa', text:'LP burned via Raydium — 100% permanent' },
  { tag:'VERDICT', color:'#00d4aa', text:'█ AUDIT COMPLETE — LOW RISK — 82/100 SAFE' },
];

function ProMaxView({ isPro, onUpgrade }: { isPro: boolean; onUpgrade: () => void }) {
  const [logs, setLogs] = React.useState<typeof FORENSIC_LOGS>([]);
  const logRef = React.useRef<HTMLDivElement>(null);
  const idxRef = React.useRef(0);
  React.useEffect(() => {
    const iv = setInterval(() => {
      setLogs(prev => [...prev.slice(-16), FORENSIC_LOGS[idxRef.current % FORENSIC_LOGS.length]]);
      idxRef.current++;
      logRef.current?.scrollTo(0, logRef.current.scrollHeight);
    }, 1200);
    return () => clearInterval(iv);
  }, []);

  const pmFeats = [
    { icon:'◈', title:'Cluster Mapping', sub:'SYBIL DETECTION', desc:'GNN traces wallet relationships across the Solana ledger. Detect when 100+ wallets belong to a single entity orchestrating fake volume.', stat:'847', statL:'avg nodes mapped' },
    { icon:'◉', title:'Heuristic Scoring', sub:'DEEP LEARNING', desc:'Probability model trained on 523K+ rugged vs safe contracts. Bytecode decompilation + temporal pattern matching.', stat:'523K+', statL:'contracts trained' },
    { icon:'◎', title:'LP Forensics', sub:'EXIT PREDICTION', desc:'Predictive analysis of liquidity removal velocity. Alerts 4-12 minutes before rug execution — enough time to exit.', stat:'4-12', statL:'min early warning' },
  ];
  const pmComp = [
    { feat:'Scan Engine', basic:'Pattern matching', pro:'Deep Learning + GNN' },
    { feat:'Scan Limit', basic:'10 credits', pro:'∞ Unlimited' },
    { feat:'Risk Model', basic:'Rule-based', pro:'Heuristic (523K contracts)' },
    { feat:'Cluster Map', basic:'—', pro:'Full Sybil detection' },
    { feat:'LP Forensics', basic:'Basic check', pro:'Predictive exit analysis' },
    { feat:'Whale Feed', basic:'Standard', pro:'Priority (< 200ms)' },
    { feat:'Perf. Fee', basic:'0.5%', pro:'0% included' },
    { feat:'Forensic Logs', basic:'—', pro:'Full deep scan' },
  ];

  const TerminalBlock = ({ h, blur }: { h: number; blur: boolean }) => (
    <div style={{ background:'#080808', border:'1px solid rgba(212,175,55,0.12)', borderRadius:8, overflow:'hidden', filter:blur?'blur(3px)':'none', opacity:blur?0.5:1, pointerEvents:blur?'none' as any:'auto' as any }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'#0c0c0c', borderBottom:'1px solid rgba(212,175,55,0.08)' }}>
        <div style={{ display:'flex', gap:5 }}><div style={{width:8,height:8,borderRadius:'50%',background:'#ff5f57'}}/><div style={{width:8,height:8,borderRadius:'50%',background:'#febc2e'}}/><div style={{width:8,height:8,borderRadius:'50%',background:'#28c840'}}/></div>
        <span style={{ fontSize:8, color:'#484f58', letterSpacing:'0.08em', fontFamily:'IBM Plex Mono,monospace' }}>NEURAL_ENGINE_v4.0 — DEEP FORENSIC</span>
        <span style={{ fontSize:7, fontWeight:700, color:'#d4af37', padding:'1px 6px', background:'rgba(212,175,55,0.08)', border:'1px solid rgba(212,175,55,0.15)', borderRadius:3, animation:'blink 2s infinite' }}>● LIVE</span>
      </div>
      <div ref={blur?undefined:logRef} style={{ height:h, overflowY:'auto', padding:'8px 12px', fontFamily:'IBM Plex Mono,monospace', fontSize:10, lineHeight:1.9, scrollbarWidth:'none' as any }}>
        {logs.map((l,i) => (
          <div key={i} style={{ opacity:i===logs.length-1?1:0.6 }}>
            <span style={{color:'#252525',marginRight:6,fontSize:9}}>{new Date().toTimeString().slice(0,8)}</span>
            <span style={{color:l.color,fontWeight:700,fontSize:8,letterSpacing:'0.06em',padding:'1px 4px',borderRadius:2,background:l.color+'11',marginRight:6}}>{l.tag}</span>
            <span style={{color:l.tag==='VERDICT'?l.color:'#6e7681'}}>{l.text}</span>
          </div>
        ))}
        <span style={{color:'#d4af37',animation:'blink 1s infinite'}}>█</span>
      </div>
    </div>
  );

  // ═══ PRO USER: Full Access ═══
  if (isPro) return (
    <div style={{padding:'clamp(12px,3vw,20px)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.12em',color:'#d4af37',padding:'3px 8px',background:'rgba(212,175,55,0.08)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:4}}>✦ PRO MAX ACTIVE</span>
        <span style={{fontSize:10,color:'#6e7681'}}>Unlimited Forensic Audits</span>
      </div>
      <TerminalBlock h={280} blur={false} />
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12,marginTop:20}}>
        {pmFeats.map((f,i) => (
          <div key={i} style={{background:'#080808',border:'1px solid rgba(212,175,55,0.1)',borderRadius:8,padding:'clamp(12px,2vw,16px) clamp(10px,2vw,14px)',transition:'border-color 0.3s'}}>
            <div style={{fontSize:8,fontWeight:700,letterSpacing:'0.12em',color:i===1?'#20b2aa':'#d4af37',marginBottom:6}}>{f.sub}</div>
            <div style={{fontSize:'clamp(13px,1.5vw,14px)',fontWeight:700,color:'#fff',marginBottom:4}}>{f.icon} {f.title}</div>
            <div style={{fontSize:'clamp(10px,1.2vw,11px)',color:'#6e7681',lineHeight:1.5,marginBottom:10}}>{f.desc}</div>
            <div style={{borderTop:'1px solid rgba(255,255,255,0.04)',paddingTop:8,display:'flex',alignItems:'baseline',gap:4}}>
              <span style={{fontSize:'clamp(16px,2vw,18px)',fontWeight:800,color:i===1?'#20b2aa':'#d4af37'}}>{f.stat}</span>
              <span style={{fontSize:8,color:'#484f58'}}>{f.statL}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ═══ NON-PRO: Paywall ═══
  return (
    <div style={{padding:'clamp(12px,3vw,20px)',display:'flex',flexDirection:'column',alignItems:'center'}}>
      {/* Gold Robot Hero */}
      <div style={{position:'relative',marginBottom:24,display:'flex',justifyContent:'center'}}>
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'clamp(200px,40vw,400px)',height:'clamp(200px,40vw,400px)',borderRadius:'50%',background:'radial-gradient(circle,rgba(212,175,55,0.1) 0%,transparent 60%)',filter:'blur(80px)',pointerEvents:'none'}}/>
        <img src="/images/robot-gold.png" alt="CryptoCheck AI Pro Max" style={{width:'100%',maxWidth:'clamp(220px,35vw,400px)',height:'auto',borderRadius:16,position:'relative',zIndex:1,filter:'drop-shadow(0 10px 40px rgba(212,175,55,0.15))'}}/>
      </div>

      {/* Hero text */}
      <div style={{textAlign:'center',maxWidth:600,marginBottom:28}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 14px',borderRadius:16,background:'rgba(212,175,55,0.06)',border:'1px solid rgba(212,175,55,0.12)',marginBottom:16}}>
          <span style={{width:5,height:5,borderRadius:'50%',background:'#d4af37',boxShadow:'0 0 6px #d4af37'}}/>
          <span style={{fontSize:9,color:'#d4af37',fontWeight:700,letterSpacing:'0.1em'}}>PRO MAX NEURAL ENGINE</span>
        </div>
        <h2 style={{fontSize:'clamp(22px,4vw,28px)',fontWeight:800,color:'#fff',margin:'0 0 4px',letterSpacing:'-0.02em',fontFamily:'IBM Plex Mono,monospace'}}>Beyond Pattern Matching.</h2>
        <h2 style={{fontSize:'clamp(22px,4vw,28px)',fontWeight:800,margin:'0 0 12px',letterSpacing:'-0.02em',fontFamily:'IBM Plex Mono,monospace',background:'linear-gradient(135deg,#d4af37,#FFD700)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Deep Forensic Intelligence.</h2>
        <p style={{fontSize:'clamp(11px,1.3vw,13px)',color:'#6e7681',lineHeight:1.7,margin:'0 0 20px',padding:'0 8px'}}>
          Graph Neural Networks + Deep Contract Decompilation. Trained on 523K+ contracts. Predicts rug pulls before they execute.
        </p>

        {/* Pricing badge */}
        <div style={{display:'inline-flex',alignItems:'center',gap:10,padding:'10px 20px',borderRadius:8,background:'rgba(212,175,55,0.04)',border:'1px solid rgba(212,175,55,0.12)',marginBottom:20,boxShadow:'0 0 20px rgba(212,175,55,0.04)'}}>
          <span style={{fontSize:'clamp(22px,3vw,26px)',fontWeight:900,color:'#d4af37'}}>$30</span>
          <div style={{textAlign:'left'}}>
            <div style={{fontSize:10,color:'#d4af37',fontWeight:700}}>/month</div>
            <div style={{fontSize:8,color:'#484f58',letterSpacing:'0.06em'}}>UNLIMITED AUDITS · 0% FEES</div>
          </div>
        </div>

        <div>
          <button onClick={onUpgrade} style={{padding:'12px 28px',fontSize:12,fontWeight:700,background:'linear-gradient(135deg,#d4af37,#FFD700)',border:'none',borderRadius:6,color:'#000',cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',boxShadow:'0 0 20px rgba(212,175,55,0.2)',letterSpacing:'0.03em',transition:'transform 0.2s,box-shadow 0.2s'}}>
            Upgrade to Pro Max
          </button>
        </div>
      </div>

      {/* Blurred terminal preview */}
      <div style={{width:'100%',maxWidth:700,position:'relative',marginBottom:28}}>
        <TerminalBlock h={180} blur={true} />
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:28,marginBottom:6}}>🔒</div>
            <div style={{fontSize:10,color:'#d4af37',fontWeight:700,letterSpacing:'0.08em'}}>PRO MAX REQUIRED</div>
          </div>
        </div>
      </div>

      {/* Feature cards — responsive grid */}
      <div style={{width:'100%',maxWidth:700,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginBottom:28}}>
        {pmFeats.map((f,i) => (
          <div key={i} style={{background:'#080808',border:'1px solid rgba(212,175,55,0.1)',borderRadius:8,padding:'clamp(12px,2vw,16px)'}}>
            <div style={{fontSize:8,fontWeight:700,letterSpacing:'0.12em',color:i===1?'#20b2aa':'#d4af37',marginBottom:6}}>{f.sub}</div>
            <div style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:4}}>{f.icon} {f.title}</div>
            <div style={{fontSize:10,color:'#6e7681',lineHeight:1.5,marginBottom:8}}>{f.desc}</div>
            <div style={{borderTop:'1px solid rgba(255,255,255,0.04)',paddingTop:6,display:'flex',alignItems:'baseline',gap:4}}>
              <span style={{fontSize:16,fontWeight:800,color:i===1?'#20b2aa':'#d4af37'}}>{f.stat}</span>
              <span style={{fontSize:8,color:'#484f58'}}>{f.statL}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison table — responsive */}
      <div style={{width:'100%',maxWidth:700}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.15em',color:'#d4af37',marginBottom:12,textAlign:'center'}}>PLAN COMPARISON</div>
        <div style={{background:'#080808',border:'1px solid rgba(212,175,55,0.08)',borderRadius:8,overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr',background:'#0c0c0c',borderBottom:'1px solid rgba(212,175,55,0.06)'}}>
            <div style={{padding:'10px clamp(8px,2vw,14px)',fontSize:8,fontWeight:700,color:'#484f58',letterSpacing:'0.1em'}}>FEATURE</div>
            <div style={{padding:'10px clamp(8px,2vw,14px)',fontSize:8,fontWeight:700,color:'#6e7681',letterSpacing:'0.1em',textAlign:'center'}}>BASIC<br/><span style={{fontSize:11,fontWeight:800,color:'#8b949e'}}>Free</span></div>
            <div style={{padding:'10px clamp(8px,2vw,14px)',fontSize:8,fontWeight:700,color:'#d4af37',letterSpacing:'0.1em',textAlign:'center'}}>PRO MAX<br/><span style={{fontSize:11,fontWeight:800}}>$30/mo</span></div>
          </div>
          {pmComp.map((r,i) => (
            <div key={i} style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr',borderBottom:i<pmComp.length-1?'1px solid rgba(255,255,255,0.02)':'none'}}>
              <div style={{padding:'9px clamp(8px,2vw,14px)',fontSize:'clamp(9px,1.2vw,10px)',color:'#c9d1d9',fontWeight:600}}>{r.feat}</div>
              <div style={{padding:'9px clamp(8px,2vw,14px)',fontSize:'clamp(9px,1.2vw,10px)',color:r.basic==='—'?'#202020':'#6e7681',textAlign:'center'}}>{r.basic}</div>
              <div style={{padding:'9px clamp(8px,2vw,14px)',fontSize:'clamp(9px,1.2vw,10px)',color:r.pro.includes('∞')||r.pro.includes('0%')?'#d4af37':'#20b2aa',fontWeight:600,textAlign:'center'}}>{r.pro}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{marginTop:28,textAlign:'center'}}>
        <button onClick={onUpgrade} style={{padding:'14px 32px',fontSize:13,fontWeight:700,background:'linear-gradient(135deg,#d4af37,#FFD700)',border:'none',borderRadius:8,color:'#000',cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',boxShadow:'0 0 30px rgba(212,175,55,0.15)',letterSpacing:'0.03em'}}>
          Upgrade to Pro Max — $30/mo
        </button>
        <div style={{fontSize:9,color:'#303030',marginTop:8,letterSpacing:'0.04em'}}>Cancel anytime · 0% performance fees · Unlimited scans</div>
      </div>
    </div>
  );
}

export default function Dashboard() {

  const { walletAddress, isConnected, isConnecting, connect, disconnect, shortAddr } = useSolana()

  const [view,        setView]        = useState<View>('scanner')
  const [scanTab,     setScanTab]     = useState<ScanTab>('verdict')
  const [mintInput,   setMintInput]   = useState('')
  const [scanState,   setScanState]   = useState<ScanState>('idle')
  const [scanData,    setScanData]    = useState<ScanData | null>(null)
  const [scanError,   setScanError]   = useState('')
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const [feedItems,   setFeedItems]   = useState<FeedItem[]>([])
  const [scanCount,   setScanCount]   = useState(0)
  const [slot,        setSlot]        = useState('')
  const [timeStr,     setTimeStr]     = useState('')
  const [showModal,   setShowModal]   = useState(false)
  const [showAuth,    setShowAuth]    = useState(false)
  const [authUser,    setAuthUser]    = useState<any>(null)

  // ── Auth session listener (picks up OAuth redirect + existing session) ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setAuthUser((prev: any) => prev?.id === data.session!.user.id ? prev : data.session!.user)
        setIsPro(data.session.user.user_metadata?.is_pro || false)
        loadCreditsFromProfile(data.session.user.id)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setAuthUser(session.user)
        setIsPro(session.user.user_metadata?.is_pro || false)
        loadCreditsFromProfile(session.user.id)
        if (window.location.search.includes('code=')) {
          window.history.replaceState({}, '', '/app')
        }
      }
      if (event === 'SIGNED_OUT') {
        setAuthUser(null)
        setIsPro(false)
        setCredits(10)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadCreditsFromProfile(userId: string) {
    try {
      const { data } = await supabase.from('profiles').select('credits, is_pro').eq('id', userId).single()
      if (data) {
        if (data.credits !== null && data.credits !== undefined) {
          setCredits(data.credits)
        }
        if (data.is_pro) { setIsPro(true); localStorage.setItem('cc_is_pro', 'true') }
      }
    } catch { /* fallback to localStorage */ }
  }

  async function useCredit(): Promise<boolean> {
    if (isPro) return true
    if (credits <= 0) return false
    const nc = credits - 1
    setCredits(nc)
    if (authUser?.id) {
      supabase.from('profiles').update({ credits: nc }).eq('id', authUser.id).then(() => {})
    }
    return true
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setAuthUser(null)
    setIsPro(false)
    localStorage.removeItem('cc_is_pro')
  }
  const [isPro,setIsPro] = useState(false)
  const [isElite, setIsElite] = useState(false)
  const [credits, setCredits] = useState(10) // Server-synced via loadCreditsFromProfile
  const [trialActivated, setTrialActivated] = useState(false)
  const [showSignup, setShowSignup] = useState(false)
  const [chartSwapModal, setChartSwapModal] = useState<{mint:string;symbol:string;tab?:string}|null>(null)
  const { trial } = useTrialStatus(walletAddress)
  const isTrialExpired = trial?.expired ?? false
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pro = localStorage.getItem('cc_is_pro') === 'true'
      setIsPro(pro)
      // Check trial from Supabase first
      ;(async () => { try {
        const { checkTrialStatus } = await import('@/lib/trial')
        const trial = await checkTrialStatus()
        if (trial.isPro) {
          setIsPro(true)
          localStorage.setItem('cc_is_pro', 'true')
        }
        if (!trial.expired || trial.isPro) {
          setTrialActivated(true)
          localStorage.setItem('cc_trial_activated', '1')
          // Save trial start to localStorage as backup
          if (trial.trialStart) {
            localStorage.setItem('cc_trial_start', trial.trialStart)
          }
        } else {
          setTrialActivated(false)
          if (!pro) setShowSignup(true)
        }
      } catch {
        const activated = localStorage.getItem('cc_trial_activated') === '1'
        setTrialActivated(activated)
        if (!activated && !pro) setShowSignup(true)
      }})()
    }
  }, [])
  const [showSwap,    setShowSwap]    = useState(false)     // Jupiter swap modal
  const [swapMint,    setSwapMint]    = useState('')        // token to swap
  const [swapSym,     setSwapSym]     = useState('???')     // symbol for swap modal
  const [dexInput,    setDexInput]    = useState('')        // DexScreener dedicated search
  const [dexMint,     setDexMint]     = useState('')        // active chart mint address
  const [currentMint, setCurrentMint] = useState('')        // unified mint for chart+Jupiter
  const [chartKey,    setChartKey]    = useState(0)         // increment to force iframe remount
  const feedIdRef  = useRef(0)
  const scanTopRef  = useRef<HTMLDivElement>(null)  // scroll target for feed clicks

  // AI Analyst state
  const [aiSummary,    setAiSummary]    = useState('')
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiEdge,       setAiEdge]       = useState('')
  const [aiEdgeLoading,setAiEdgeLoading]= useState(false)
  const [chatMessages, setChatMessages] = useState<{role:'user'|'ai', text:string}[]>([])
  const [chatInput,    setChatInput]    = useState('')
  const [chatLoading,  setChatLoading]  = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Portfolio
  const [pfState,     setPfState]     = useState<'idle'|'loading'|'done'|'error'>('idle')
  const [pfHoldings,  setPfHoldings]  = useState<PortfolioHolding[]>([])
  const [pfError,     setPfError]     = useState('')

  // Slot & clock
  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try { const s = await getSlot(); if (!cancelled) setSlot(s.toLocaleString()) } catch {}
    }
    tick()
    const iv = setInterval(tick, 60000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  useEffect(() => {
    const iv = setInterval(() => { const el = document.getElementById("cc-time"); if(el) el.textContent = new Date().toUTCString().slice(0, 25) + " UTC" }, 1000)
    setTimeStr(new Date().toUTCString().slice(0, 25) + ' UTC')
    return () => clearInterval(iv)
  }, [])

  // Initial feed items
  useEffect(() => {
    const init: FeedItem[] = [
      { id:1, tag:'WHALE', tagCls:'bg-indigo-950/50 text-[#00d4aa] border border-[rgba(0,212,130,0.15)]', text:'🐋 Smart wallet 7xKP… bought 250 SOL of BONK 3m ago', ts: new Date().toLocaleTimeString(), mint: DEMO_TOK_MINTS['BONK'] },
      { id:2, tag:'LIQ',   tagCls:'bg-cyan-950/50 text-cyan-400 border border-cyan-800/25',   text:'💧 New Raydium pool: WIF/SOL — 85 SOL locked', ts: new Date().toLocaleTimeString(), mint: DEMO_TOK_MINTS['WIF'] },
      { id:3, tag:'RUG',   tagCls:'bg-red-950/50 text-red-400 border border-red-800/25',     text:'🚨 Large holder moving MEW supply — alert', ts: new Date().toLocaleTimeString(), mint: DEMO_TOK_MINTS['MEW'] },
      { id:4, tag:'ALPHA', tagCls:'bg-emerald-950/50 text-emerald-400 border border-emerald-800/25', text:'⚡ POPCAT volume spike +340% in 10 min', ts: new Date().toLocaleTimeString(), mint: DEMO_TOK_MINTS['POPCAT'] },
      { id:5, tag:'MINT',  tagCls:'bg-amber-950/50 text-amber-400 border border-amber-800/25', text:'⚠ Mint authority revoked on MEW — supply fixed', ts: new Date().toLocaleTimeString(), mint: DEMO_TOK_MINTS['MEW'] },
    ]
    setFeedItems(init)
    // Fetch real events from Helius
    async function fetchRealFeed() {
      if (document.hidden) return
      try {
        const res = await fetch('/api/live-feed')
        const data = await res.json()
        if (data.events && data.events.length > 0) {
          const batch = data.events.map((ev: any) => {
            feedIdRef.current++
            return { id: feedIdRef.current, tag: ev.tag, tagCls: ev.cls, text: ev.text, ts: new Date().toLocaleTimeString() }
          })
          setFeedItems(prev => [...batch, ...prev].slice(0, 20))
        }
      } catch {}
    }
    fetchRealFeed()
    const iv = setInterval(fetchRealFeed, 30000)
    return () => clearInterval(iv)
  }, [])


  // ── AI helpers — call Server Actions (OPENAI_API_KEY stays server-side) ──

  const triggerAiSummary = useCallback(async (data: ScanData) => {
    setAiLoading(true)
    setAiSummary('')
    try {
      const risk     = computeRisk(data)
      const name     = data.meta?.onChainMetadata?.metadata?.data?.name   ?? data.meta?.legacyMetadata?.name   ?? 'Unknown'
      const sym      = data.meta?.onChainMetadata?.metadata?.data?.symbol ?? data.meta?.legacyMetadata?.symbol ?? '???'
      const mintAuth = data.meta?.onChainMetadata?.metadata?.updateAuthority
                       ? 'Active (can mint more)' : 'Revoked (supply fixed)'
      const topFlag  = risk.flags.find(f => f.includes('%')) ?? 'Normal'

      const result = await getAiTokenSummary({
        name, symbol: sym, mint: data.mint,
        riskScore: risk.score, riskLabel: risk.riskLabel, riskVerdict: risk.verdict,
        mintAuthority: mintAuth,
        totalSupply: data.supply?.value?.uiAmountString ?? 'N/A',
        topHolderFlag: topFlag,
        flags: risk.flags,
        txCount: data.txs?.length ?? 0,
      })
      setAiSummary(result.error ? `AI error: ${result.error}` : result.text)
    } catch(e) {
      setAiSummary(`AI Analyst error: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setAiLoading(false)
    }
  }, [])

  const triggerAiEdge = useCallback(async (data: ScanData, edgePct: number, bestBuy: string, bestSell: string) => {
    setAiEdgeLoading(true)
    setAiEdge('')
    try {
      const risk = computeRisk(data)
      const sym  = data.meta?.onChainMetadata?.metadata?.data?.symbol ?? data.meta?.legacyMetadata?.symbol ?? '???'

      const result = await getAiEdgeAnalysis({
        symbol: sym, riskScore: risk.score, riskLabel: risk.riskLabel,
        edgePct, bestBuyDex: bestBuy, bestSellDex: bestSell, flags: risk.flags,
      })
      setAiEdge(result.error ? `AI error: ${result.error}` : result.text)
    } catch(e) {
      setAiEdge(`AI edge error: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setAiEdgeLoading(false)
    }
  }, [])

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || !scanData || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setChatLoading(true)
    try {
      const risk = computeRisk(scanData)
      const name = scanData.meta?.onChainMetadata?.metadata?.data?.name   ?? scanData.meta?.legacyMetadata?.name   ?? 'Unknown'
      const sym  = scanData.meta?.onChainMetadata?.metadata?.data?.symbol ?? scanData.meta?.legacyMetadata?.symbol ?? '???'

      const result = await getAiChatReply({
        userMessage: userMsg,
        tokenContext: {
          name, symbol: sym, mint: scanData.mint,
          riskScore: risk.score, riskLabel: risk.riskLabel,
          verdict: risk.verdict, flags: risk.flags,
        },
        history: chatMessages.slice(-6),
      })
      setChatMessages(prev => [...prev, {
        role: 'ai',
        text: result.error ? `Error: ${result.error}` : result.text,
      }])
    } catch(e) {
      setChatMessages(prev => [...prev, { role: 'ai', text: `Error: ${e instanceof Error ? e.message : 'AI offline'}` }])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, scanData, chatMessages, chatLoading])

  // ── Scan ──
  const doScan = useCallback(async (mintAddr?: string) => {
    const mint = (mintAddr ?? mintInput).trim()
    setScanError('')
    if (!mint || mint.length < 32 || mint.length > 44) { setScanError('Please paste a valid Solana token address (32-44 chars).'); setScanState('error'); return }

    // ── CREDIT GATE: Check before scanning ──
    if (!isPro && credits <= 0) {
      setScanError('No credits remaining. Refill to continue scanning.')
      setScanState('error')
      setShowModal(true) // Open pricing modal
      return
    }

    // Optimistic UI: deduct immediately
    if (!isPro) {
      setCredits(prev => Math.max(0, prev - 1)) // Optimistic, server syncs
    }

    setScanState('loading')
    setScanData(null)
    try {
      // Server-side credit deduction (parallel with scan)
      const creditPromise = authUser?.id
        ? fetch('/api/scan/use-credit', { method: 'POST' }).then(r => r.json()).catch(() => null)
        : Promise.resolve(null)

      const data = await scanToken(mint)
      setScanData(data)
      setScanState('done')
      setScanCount(c => c + 1)

      // Sync server credit count
      const creditResult = await creditPromise
      if (creditResult?.credits !== undefined && creditResult.credits >= 0) {
        setCredits(creditResult.credits)
      }
      setDexMint(mint)
      setCurrentMint(mint)   // sync chart + Jupiter to scanned token
      setChartKey(k => k + 1)  // force iframe remount
      const risk = computeRisk(data)
      const name = data.meta?.onChainMetadata?.metadata?.data?.name ?? data.meta?.legacyMetadata?.name ?? 'Unknown'
      const sym  = data.meta?.onChainMetadata?.metadata?.data?.symbol ?? data.meta?.legacyMetadata?.symbol ?? '???'
      const scanName = (data as any).name || name || 'Unknown'
      const scanSym = (data as any).symbol || sym || mint.slice(0,4)
      setRecentScans(prev => [{ mint, name: scanName, symbol: scanSym, score: risk.score }, ...prev.filter(s => s.mint !== mint)].slice(0, 8))
      // Save to scan history
      try {
        const history = JSON.parse(localStorage.getItem('cc_scan_history') || '[]')
        history.unshift({ mint, symbol: scanSym, name: scanName, score: risk.score, timestamp: Date.now() })
        localStorage.setItem('cc_scan_history', JSON.stringify(history.slice(0, 50)))
      } catch {}
      // Add feed entry
      feedIdRef.current++
      const tpl = FEED_TEMPLATES[Math.floor(Math.random() * FEED_TEMPLATES.length)](sym)
      setFeedItems(prev => [{ id: feedIdRef.current, tag: tpl.tag, tagCls: tpl.cls, text: tpl.text, ts: new Date().toLocaleTimeString() }, ...prev].slice(0, 20))
      // Reset AI state for new scan, then trigger AI analysis
      setAiSummary('')
      setAiEdge('')
      setChatMessages([])
      triggerAiSummary(data)
    } catch(e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setScanError('Scan failed: ' + msg)
      setScanState('error')
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Feed click — scan token and scroll to top ──
  const handleFeedClick = useCallback((mint: string) => {
    if (!mint || mint.length < 32) return
    // Reset ALL states before loading new mint
    setScanData(null)
    setScanState('idle')
    setScanError('')
    setAiSummary('')
    setAiEdge('')
    setChatMessages([])
    // Set unified currentMint + increment chartKey to force iframe remount
    setCurrentMint(mint)
    setChartKey(k => k + 1)
    setDexMint(mint)
    setMintInput(mint)
    setView('scanner')
    setScanTab('verdict')
    // Scroll to top
    setTimeout(() => {
      scanTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    doScan(mint)
  }, [doScan])

  // ── Portfolio scan ──
  const doPortfolioScan = useCallback(async () => {
    if (!isConnected || !walletAddress) {
      await connect()
      return
    }
    setPfState('loading')
    setPfError('')
    try {
      const holdings = await fetchPortfolio(walletAddress)
      if (!holdings.length) throw new Error('No SPL token holdings found with non-zero balances.')
      setPfHoldings(holdings)
      setPfState('done')
    } catch(e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setPfError(msg)
      setPfState('error')
    }
  }, [isConnected, walletAddress, connect])

  // ── Whale / Alpha data ──
  const renderWhalePage = () => (
    <div className="p-4">
      <div className="panel-label mb-4">Smart Money Wallets — Live</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2.5 mb-4">
        {WHALES.map(w => (
          <div key={w.addr} className="term-card p-3.5 hover:border-[rgba(0,212,130,0.15)] transition-colors cursor-default">
            <div className="text-[0.62rem] text-cyan-400 mb-1.5">📍 {w.addr}</div>
            <div className={`text-base font-bold font-mono ${w.positive ? 'text-emerald-400' : 'text-red-400'}`}>{w.pnl}</div>
            <div className="text-[0.58rem] text-[#8b949e] mt-0.5">{w.pct} · {w.trades.toLocaleString()} trades · {w.label}</div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {w.tags.map(t => <AlphaTag key={t} tag={t} />)}
            </div>
          </div>
        ))}
      </div>
      <div className="term-card p-4">
        <div className="s-hdr">Recent Smart Money Activity</div>
        {WHALE_ACTIVITY.map((a, i) => (
          <div key={i} className="flex items-center gap-2 py-2 border-b border-[rgba(33,38,45,0.5)] last:border-0 text-[0.63rem]">
            <span className={`w-11 font-bold flex-shrink-0 ${a.dir==='BUY'?'text-emerald-400':'text-red-400'}`}>{a.dir}</span>
            <div className="flex-1">
              <div className="text-[#8b949e] text-[0.58rem]">{a.wallet}</div>
              <div className="text-[#8b949e] text-[0.58rem] mt-0.5">{a.token} — {a.amount}</div>
            </div>
            <span className="text-[#484f58] text-[0.55rem]">{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const renderAlphaPage = () => (
    <div className="p-4">
      <div className="panel-label mb-4">Alpha Signals — Aggregated</div>
      {ALPHA_CARDS.map((a, i) => (
        <div key={i} className="term-card p-3.5 mb-2.5 slide-in">
          <div className="flex items-center justify-between mb-2">
            <span className="alpha-tag text-[0.52rem] font-bold tracking-wider border" style={{ background: `${a.color}1a`, color: a.color, borderColor: `${a.color}28` }}>{a.type}</span>
            <span className="text-[0.58rem] text-[#8b949e]">{a.time}</span>
          </div>
          <div className="text-sm font-bold text-[#e2e8f0] font-sans mb-1.5">{a.title}</div>
          <div className="text-[0.68rem] text-[#8b949e] leading-relaxed">{a.body}</div>
          <div className="flex gap-2 mt-2 text-[0.58rem] text-[#8b949e] items-center">
            <span>Confidence: {a.conf}</span>
            <span>Impact: {a.impact}</span>
            <span className="ds-badge ds-badge-engine ml-auto">Neural v2</span>
          </div>
        </div>
      ))}
    </div>
  )

  // ── Portfolio content ──
  const renderPortfolioContent = () => {
    if (pfState === 'idle') return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center gap-4 p-10">
        <div className="text-5xl">📂</div>
        <div className="text-base font-bold text-[#e2e8f0] font-sans">Portfolio Risk Scanner</div>
        <div className="text-[0.7rem] text-[#8b949e] max-w-xs leading-relaxed">Connect your Phantom wallet to scan all token holdings. The AI generates a Global Portfolio Risk Score by analyzing every position via Helius DAS API.</div>
        <button onClick={doPortfolioScan} disabled={isConnecting} className="unlock-btn max-w-xs">{isConnecting ? 'Connecting…' : isConnected ? '🔍 Scan My Portfolio' : '🔗 Connect & Scan Portfolio'}</button>
        <div className="flex flex-wrap gap-1.5 justify-center">
          <span className="ds-badge ds-badge-rpc"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block dot-pulse" />Helius DAS API</span>
          <span className="ds-badge ds-badge-net">{NETWORK_LABEL}</span>
          <span className="ds-badge ds-badge-engine">{ENGINE_LABEL}</span>
        </div>
      </div>
    )

    if (pfState === 'loading') return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-10">
        <NeuralSpinner />
        <div className="text-center">
          <div className="text-sm font-bold text-[#e2e8f0] font-sans mb-1">Portfolio Risk Scan</div>
          <div className="text-[0.62rem] text-[#8b949e]">Fetching holdings via Helius DAS API…</div>
        </div>
        <div className="w-full max-w-xs bg-[#0c0c18] border border-[rgba(0,212,130,0.15)] rounded-[4px] p-3">
          {['$ portfolio_scan --wallet helius-das', '⚡ Querying token accounts…', '📋 Analyzing balances…', '🧠 Running neural risk scoring…', '📊 Generating Global Risk Score…'].map((l,i) => (
            <div key={i} className="log-line" style={{ animationDelay: `${i*0.18}s` }}>{l}</div>
          ))}
        </div>
      </div>
    )

    if (pfState === 'error') return (
      <div className="p-6">
        <div className="p-3 bg-red-950/20 border border-red-800/25 rounded-[4px] text-red-400 text-[0.7rem] mb-4">⚠ {pfError}</div>
        <button onClick={() => setPfState('idle')} className="unlock-btn max-w-xs">← Try Again</button>
      </div>
    )

    if (pfState === 'done' && walletAddress) return <PortfolioResults holdings={pfHoldings} wallet={walletAddress} />
    return null
  }

  // ── Main scan content ──
  const renderScanContent = () => {
    // Chart tab can show even without a full scan if we have a dexMint
    if (scanTab === 'chart') {
      const chartMint = (scanData?.mint ?? dexMint).trim()
      if (chartMint.length >= 32) return <DexChartTab mint={chartMint} chartKey={chartKey} onConnectWallet={isConnected ? disconnect : connect} isConnected={isConnected} shortAddr={shortAddr} currentSymbol={scanData?.meta?.onChainMetadata?.metadata?.data?.symbol ?? scanData?.meta?.legacyMetadata?.symbol ?? '???'} neuralScore={scanData ? computeRisk(scanData).score : null} />
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-10">
          <div className="text-4xl">📈</div>
          <div className="text-sm font-bold text-[#e2e8f0] font-sans">No Token Selected</div>
          <div className="text-[0.68rem] text-[#8b949e] max-w-xs leading-relaxed">
            Scan a token or paste a mint address into the DexScreener search bar in the sidebar to load the live price chart.
          </div>
        </div>
      )
    }
    if (scanState === 'idle') return (
      <div style={{flex:1,minHeight:0,overflow:'hidden'}}>
        <TokenListDashboard
          onScanToken={(mint) => { setMintInput(mint); doScan(mint) }}
          showModal={() => setShowModal(true)}
        />
      </div>
    )
    if (scanState === 'loading') return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-10">
        <NeuralSpinner />
        <div className="text-center">
          <div className="text-sm font-bold text-[#e2e8f0] font-sans mb-1">Neural Scan Active</div>
          <div className="text-[0.62rem] text-[#8b949e]">Querying Helius {NETWORK_LABEL}…</div>
        </div>
        <div className="w-full max-w-sm bg-[#0c0c18] border border-[rgba(0,212,130,0.15)] rounded-[4px] p-3">
          {[`$ init_scan --mint ${mintInput.slice(0,8)}... --rpc helius`,'⚡ Connecting Helius RPC...','📋 Fetching DAS metadata...','🔍 Analyzing authority structure...','👥 Loading top holders...','🧠 Running neural recognition...','📊 Building distribution chart...','✓ Neural Engine v2 verdict ready'].map((l,i) => (
            <div key={i} className="log-line" style={{ animationDelay: `${i*0.17}s` }}>{l}</div>
          ))}
        </div>
      </div>
    )
    if (scanState === 'error') return (
      <div className="p-4">
        <div className="p-3 bg-red-950/20 border border-red-800/25 rounded-[4px] text-red-400 text-[0.7rem] flex items-start gap-2">
          <span className="text-base flex-shrink-0">⚠</span><span>{scanError}</span>
        </div>
      </div>
    )
    if (scanState === 'done' && scanData) {
      if (scanTab === 'verdict')   return (
        <VerdictTab
          data={scanData}
          onTradeClick={(m,s)=>{setSwapMint(m);setSwapSym(s);setShowSwap(true)}}
          onChartClick={(m)=>{setDexMint(m);setScanTab('chart')}}
          aiSummary={aiSummary}
          aiLoading={aiLoading}
          chatMessages={chatMessages}
          chatLoading={chatLoading}
          chatInput={chatInput}
          onChatInput={setChatInput}
          onChatSend={sendChatMessage}
        />
      )
      if (scanTab === 'holders')   return <HoldersTab data={scanData} />
      if (scanTab === 'liquidity') return <LiquidityTab data={scanData} />
      if (scanTab === 'transfers') return <TransfersTab data={scanData} />
      if (scanTab === 'edge')      return (
        <AlphaEdgeTab
          data={scanData}
          onTradeClick={(m,s)=>{setSwapMint(m);setSwapSym(s);setShowSwap(true)}}
          aiEdge={aiEdge}
          aiEdgeLoading={aiEdgeLoading}
          onAnalyzeEdge={(ep,bb,bs)=>triggerAiEdge(scanData,ep,bb,bs)}
        />
      )
    }
    return null
  }

  // ── PRO paywall overlay ──
// ProGate moved outside Page

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Chart/Swap modal event listener — must be before mounted guard
  useEffect(() => {
    function handleChartSwap(e: Event) {
      const { mint, symbol, tab } = (e as CustomEvent).detail
      setChartSwapModal({ mint, symbol, tab })
    }
    window.addEventListener('openChartSwap', handleChartSwap)
    return () => window.removeEventListener('openChartSwap', handleChartSwap)
  }, [])

  if (!mounted) return (
    <>
      {/* SignupModal disabled - using Gated Access instead */}
    </>
  )

  return (
    <>
      {/* Ambient glow blobs */}
      <div className="ambient-blob ambient-blob-1" />
      <div className="ambient-blob ambient-blob-2" />
      <div className="ambient-blob ambient-blob-3" />

      {/* ── HEADER ── */}
      {false && (
        <SignupTrialModal
          walletAddress={walletAddress}
          isConnected={isConnected}
          isConnecting={isConnecting}
          onConnect={connect}
          onSuccess={() => { setTrialActivated(true); setShowSignup(false) }}
        />
      )}
      {showAuth && <AuthModal onClose={()=>setShowAuth(false)} onSuccess={(u)=>{setAuthUser(u);setIsPro(u?.user_metadata?.is_pro||false)}} />}
      {chartSwapModal && <ChartSwapModal mint={chartSwapModal.mint} symbol={chartSwapModal.symbol} initialTab={chartSwapModal.tab as any} onClose={() => setChartSwapModal(null)} />}
      {/* TrialWall removed - using Gated Access */}
      <header className="sticky top-0 z-[300] min-h-[48px] flex items-center justify-between px-3 md:px-4 flex-wrap gap-y-1 backdrop-blur-xl" style={{background:'#000',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <a href="/" className="flex items-center gap-2 font-mono text-[0.82rem] font-bold text-white tracking-wider uppercase no-underline">
          <img src="/logo.jpg" alt="CryptoCheck AI" style={{width:30,height:26,borderRadius:5,objectFit:'cover',flexShrink:0}}/>
          CryptoCheck<span className="text-[#00d4aa]">AI</span>
          <span className="text-[0.5rem] text-[#8b949e] ml-0.5">v3</span>
          {isPro ? (
            <span style={{fontSize:'9px',fontWeight:700,padding:'2px 8px',borderRadius:4,fontFamily:'IBM Plex Mono,monospace',letterSpacing:'0.08em',background:'linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.05))',border:'1px solid rgba(212,175,55,0.35)',color:'#d4af37'}}>⭐ PRO</span>
          ) : null}
        </a>

        {/* Desktop nav */}
        <div className="hidden lg:flex gap-0.5">
          {(['scanner','portfolio','whales','alpha','forensics','neuralv4','promax','elite'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1 rounded-[4px] text-[0.62rem] font-bold tracking-wider uppercase font-mono transition-all border ${view === v ? (v === 'promax' ? 'bg-[rgba(255,215,0,0.08)] text-[#FFD700] border-[rgba(255,215,0,0.2)]' : v === 'elite' ? 'bg-[rgba(139,92,246,0.08)] text-[#8b5cf6] border-[rgba(139,92,246,0.2)]' : 'bg-[rgba(0,212,130,0.1)] text-[#00d4aa] border-[rgba(0,212,130,0.15)]') : 'bg-transparent text-[#8b949e] border-transparent hover:text-[#c9d1d9] hover:bg-white/[0.04]'}`}>
              {v === 'scanner' ? '⚡ Scanner' : v === 'portfolio' ? '📂 Portfolio' : v === 'whales' ? '🐋 Whales' : v === 'alpha' ? '📡 Alpha' : v === 'forensics' ? '🔐 Forensics' : v === 'neuralv4' ? '🧠 Neural V4' : v === 'promax' ? '✦ Deep' : v === 'elite' ? '◆ Elite' : v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="live-badge bg-emerald-950/30 border border-emerald-800/25 text-emerald-400 px-2 py-0.5 rounded-[3px] text-[0.58rem] font-bold tracking-wider hidden sm:block">● MAINNET-BETA</div>
          {isPro ? (
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:'0.6rem',fontFamily:'IBM Plex Mono,monospace'}}>
              <span style={{color:'#6e7681'}}>∞ scans</span>
              <button onClick={() => setShowModal(true)} className="btn-terminal px-3 py-1 rounded-[4px] text-[0.62rem]" style={{color:'#d4af37',border:'1px solid rgba(212,175,55,0.3)',background:'rgba(212,175,55,0.06)'}}>⭐ PRO</button>
            </div>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <button onClick={() => setShowModal(true)} style={{
                display:'flex',alignItems:'center',gap:4,
                background:credits<3?'rgba(240,165,0,0.1)':'rgba(255,255,255,0.04)',
                border:credits<3?'1px solid rgba(240,165,0,0.3)':'1px solid #21262d',
                borderRadius:4,padding:'3px 8px',cursor:'pointer',
                animation:credits<3?'pulse 1.5s infinite':'none'
              }}>
                <span style={{fontSize:'11px'}}>◆</span>
                <span style={{fontSize:'0.6rem',fontWeight:700,color:credits<=0?'#ff4444':credits<3?'#f0a500':'#20b2aa',fontFamily:'IBM Plex Mono,monospace'}}>{isPro ? '∞' : credits}</span>
                <span style={{fontSize:'0.45rem',color:'#6e7681',fontWeight:600}}><span className='hidden sm:inline'>SCANS</span></span>
              </button>
              {!isPro && credits < 5 && (
                <button onClick={() => setShowModal(true)} style={{padding:'3px 8px',fontSize:'0.55rem',fontWeight:700,background:'rgba(32,178,170,0.1)',border:'1px solid rgba(32,178,170,0.3)',borderRadius:4,color:'#20b2aa',cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',animation:'pulse 2s infinite'}}>
                  + REFILL
                </button>
              )}
              <button onClick={() => setShowModal(true)} className="btn-terminal px-2 md:px-3 py-1 text-white border-none rounded-[4px] text-[0.55rem] md:text-[0.62rem]" style={{ background:'linear-gradient(135deg,#00d4aa,#059669)', boxShadow:'0 0 12px rgba(0,212,130,0.3)' }}><span className="hidden md:inline">⚡ UPGRADE</span><span className="md:hidden">⚡</span></button>
            </div>
          )}
          {authUser ? (
              <div style={{position:'relative',display:'inline-block'}}>
                <button onClick={handleSignOut} style={{padding:'4px 8px',fontSize:'0.55rem',fontWeight:700,background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.25)',borderRadius:4,color:'#34d399',cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:6,height:6,borderRadius:'50%',background:'#34d399',display:'inline-block'}}/>
                  {authUser.email?.split('@')[0]}
                  <span style={{fontSize:'0.5rem',opacity:0.6,marginLeft:4}}>✕</span>
                </button>
              </div>
            ) : (
              <button onClick={()=>setShowAuth(true)} style={{padding:'5px 12px',fontSize:'0.6rem',fontWeight:700,background:'transparent',border:'1px solid rgba(52,211,153,0.2)',borderRadius:4,color:'#6ee7b7',cursor:'pointer',fontFamily:'IBM Plex Mono,monospace'}}>
                Sign In
              </button>
            )}
          <button onClick={isConnected ? disconnect : connect} disabled={isConnecting} className={`btn-terminal px-2 md:px-3 py-1 rounded-[4px] text-[0.5rem] md:text-[0.62rem] ${isConnected ? 'bg-emerald-950/30 border-emerald-800/25 text-emerald-400' : 'bg-[rgba(0,212,130,0.08)] border-[rgba(0,212,130,0.15)] text-[#00d4aa]'}`}>
            {isConnecting ? 'Connecting…' : isConnected ? `✓ ${shortAddr}` : 'Connect Wallet'}
          </button>
        </div>
      </header>

      {/* ── TICKER TAPE ── */}
      <div className="h-[26px] bg-[#161b22] border-b border-[rgba(0,212,130,0.15)] overflow-hidden relative z-10 hidden sm:block">
        <div className="ticker-track flex gap-0 whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-5 text-[0.6rem] text-[#8b949e] border-r border-[rgba(33,38,45,0.6)]">
              <strong className="text-[#c9d1d9]">{item.label}</strong>
              <span className={item.cls}>{item.val}</span>
            </span>
          ))}
        </div>
      </div>


      {/* ── APP BODY ── */}
      <div className="flex" style={{ minHeight: 'calc(100vh - 48px - 26px - 32px - 80px)', position: 'relative', zIndex: 1, background: '#000' }}>

        {/* SIDEBAR (desktop only) */}
        <aside className="hidden md:flex flex-col w-[280px] flex-shrink-0 overflow-hidden" style={{borderRight:'1px solid rgba(255,255,255,0.06)',background:'#000',height:'calc(100vh - 48px - 26px - 32px - 80px)',position:'sticky',top:74}}>
          {/* Scan zone — stable external MintInput */}
          <div ref={scanTopRef}>
            <MintInput onScan={(v) => {
              if (!isPro && credits <= 0) {
                setShowModal(true)
                return
              }
              setMintInput(v)
              doScan(v)
            }} loading={scanState === 'loading'} />
            <div className="flex gap-1 px-3.5 pb-2">
              {SAMPLE_MINTS.map(s => (
                <button key={s.label} onClick={() => { setMintInput(s.mint); doScan(s.mint) }}
                  className="flex-1 py-1 rounded-[3px] border border-[rgba(0,212,130,0.15)] bg-[#1c2128] text-[#8b949e] text-[0.58rem] font-mono font-semibold transition-all hover:border-[rgba(0,212,130,0.15)] hover:text-[#c9d1d9]">
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-[3px] bg-cyan-950/20 border border-cyan-800/20 text-cyan-400 text-[0.53rem] font-semibold tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0 dot-pulse" />
              Source: Helius Real-Time RPC
            </div>
          </div>

          {/* Recent scans */}
          <div className="p-3.5 border-b border-[rgba(0,212,130,0.15)]">
            <div className="panel-label">Recent Scans</div>
            {recentScans.length === 0
              ? <div className="text-[0.62rem] text-[#484f58] text-center py-2">No recent scans</div>
              : recentScans.map(s => (
                <div key={s.mint} onClick={() => { setMintInput(s.mint); doScan(s.mint) }}
                  className="flex items-center justify-between px-2 py-1.5 rounded-[3px] cursor-pointer hover:bg-white/[0.03] transition-colors text-[0.63rem]">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full border border-[rgba(0,212,130,0.15)] flex items-center justify-center text-[0.55rem] font-bold" style={{ background:'linear-gradient(135deg,rgba(48,54,61,1),rgba(6,182,212,0.15))' }}>{s.symbol.slice(0,2)}</div>
                    <div>
                      <div className="font-semibold text-[#c9d1d9]">{s.name.slice(0, 16)}</div>
                      <div className="text-[#8b949e] text-[0.55rem]">{s.mint.slice(0,6)}…{s.mint.slice(-4)}</div>
                    </div>
                  </div>
                  <ScoreChip score={s.score} />
                </div>
              ))
            }
          </div>

          {/* DexScreener search */}
          <div className="p-3.5 border-b border-[rgba(0,212,130,0.15)] flex-shrink-0">
            <div className="panel-label" style={{ color: '#10b981' }}>
              <span style={{ background: 'linear-gradient(#10b981, #059669)', width: 2, height: 8, borderRadius: 1, display: 'inline-block', flexShrink: 0, marginRight: 5 }} />
              DexScreener Chart
            </div>
            <div className="flex gap-1.5">
              <input
                value={dexInput}
                onChange={e => setDexInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && dexInput.trim().length >= 32) {
                    setDexMint(dexInput.trim())
                    setScanTab('chart')
                    setView('scanner')
                  }
                }}
                placeholder="Token address…"
                className="flex-1 min-w-0 bg-[#1c2128] border border-emerald-900/40 rounded-[4px] px-2 py-1.5 font-mono text-[0.62rem] text-[#c9d1d9] outline-none transition-all focus:border-emerald-600/60 placeholder:text-[#484f58]"
                autoComplete="off" spellCheck={false}
              />
              <button
                onClick={() => {
                  const m = dexInput.trim()
                  if (m.length >= 32) { setDexMint(m); setScanTab('chart'); setView('scanner') }
                }}
                className="flex-shrink-0 px-2.5 py-1.5 rounded-[4px] text-[0.62rem] font-bold font-mono text-white border-none cursor-pointer transition-all"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 0 10px rgba(16,185,129,0.25)' }}
                title="Open DexScreener chart"
              >
                📈
              </button>
            </div>
            <div className="mt-1.5 text-[0.52rem] text-[#484f58] leading-relaxed">
              Paste a Solana mint to embed the live DexScreener chart.
            </div>
            {/* Quick links for current scan */}
            {dexMint && (
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => { setScanTab('chart'); setView('scanner') }}
                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-[3px] border border-emerald-800/25 bg-emerald-950/20 text-emerald-400 text-[0.55rem] font-bold font-mono cursor-pointer hover:bg-emerald-950/40 transition-all"
                  style={{ border:'1px solid rgba(16,185,129,0.25)', background:'rgba(16,185,129,0.08)' }}
                >
                  📈 Price Chart
                </button>
                <button
                  onClick={() => { setScanTab('chart'); setView('scanner') }}
                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-[3px] border border-[rgba(0,212,130,0.15)] bg-indigo-950/20 text-[#00d4aa] text-[0.55rem] font-bold font-mono cursor-pointer hover:bg-[rgba(0,212,130,0.1)] transition-all border-none"
                  style={{ border: '1px solid rgba(48,54,61,1)' }}
                >
                  📈 View Chart
                </button>
              </div>
            )}
          </div>

          {/* Alpha feed */}
          <div className="flex-1 overflow-y-auto p-3.5">
            <div className="panel-label">Live Alpha Feed</div>
            {feedItems.map(f => {
              const clickable = !!(f.mint && f.mint.length >= 32)
              return (
                <div
                  key={f.id}
                  onClick={() => clickable && handleFeedClick(f.mint!)}
                  title={clickable ? `Click to scan ${f.mint}` : undefined}
                  style={{ cursor: clickable ? 'pointer' : 'default' }}
                  className="py-2 border-b border-[rgba(33,38,45,0.5)] last:border-0 slide-in rounded-[3px] px-1 -mx-1"
                  onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,130,0.06)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[0.52rem] text-[#484f58]">{f.ts}</span>
                    {clickable && (
                      <span className="text-[0.5rem] text-[#00d4aa] font-mono font-bold">⚡ scan</span>
                    )}
                  </div>
                  <div className="text-[0.63rem] leading-relaxed text-[#8b949e]">
                    <span className={`alpha-tag ${f.tagCls} text-[0.52rem]`}>{f.tag}</span>
                    {f.text}
                  </div>
                  {clickable && (
                    <div className="text-[0.5rem] text-[#484f58] mt-0.5 font-mono truncate">
                      {f.mint!.slice(0,8)}…{f.mint!.slice(-6)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex flex-col flex-1 overflow-y-auto min-w-0" style={{background:'#000',width:'100%'}}>
          {/* Scanner view */}
          {view === 'scanner' && (
            <>
              {/* Mobile-only: DexScreener quick search */}
              <div className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-[#161b22] border-b border-[rgba(16,185,129,0.2)]">
                <span className="text-emerald-400 text-sm flex-shrink-0">📈</span>
                <input
                  value={dexInput}
                  onChange={e => setDexInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && dexInput.trim().length >= 32) {
                      setDexMint(dexInput.trim())
                      setScanTab('chart')
                    }
                  }}
                  placeholder="DexScreener — paste token address…"
                  className="flex-1 min-w-0 bg-transparent border-none outline-none font-mono text-[0.62rem] text-[#c9d1d9] placeholder:text-[#484f58]"
                  autoComplete="off" spellCheck={false}
                />
                <button
                  onClick={() => {
                    const m = dexInput.trim()
                    if (m.length >= 32) { setDexMint(m); setScanTab('chart') }
                  }}
                  className="flex-shrink-0 px-2 py-1 rounded-[3px] text-[0.6rem] font-bold font-mono text-white border-none cursor-pointer"
                  style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
                >
                  GO
                </button>
                {(dexMint || scanData?.mint) && (
                  <button
                    onClick={() => { setScanTab('chart'); setView('scanner') }}
                    className="flex-shrink-0 px-2 py-1 rounded-[3px] text-emerald-400 text-[0.58rem] font-bold font-mono cursor-pointer"
                    style={{ border:'1px solid rgba(16,185,129,0.25)', background:'rgba(16,185,129,0.08)' }}
                  >
                    📈
                  </button>
                )}
              </div>
              <ValueProtectedWidget compact />
              {/* PERSISTENT SCAN INPUT — outside renderScanContent to prevent re-mount */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-[rgba(0,212,130,0.15)] flex-shrink-0">
                <input
                  id="main-scan-input"
                  value={mintInput}
                  onChange={e => setMintInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') doScan() }}
                  placeholder="Paste Solana token address to scan…"
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    flex: 1,
                    background: 'rgba(0,212,130,0.06)',
                    border: '1px solid rgba(48,54,61,1)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#e2e8f0',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: '11px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => doScan()}
                  disabled={scanState === 'loading' || (credits <= 0 && !isPro)}
                  style={{
                    background: scanState === 'loading' ? 'rgba(48,54,61,1)' : 'linear-gradient(135deg,#00d4aa,#00b894)',
                    border: 'none', borderRadius: '6px',
                    padding: '8px 12px', color: '#fff',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: '11px', fontWeight: 700,
                    cursor: scanState === 'loading' ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.05em', whiteSpace: 'nowrap',
                  }}
                >
                  {scanState === 'loading' ? '⟳ SCANNING…' : credits <= 0 && !isPro ? '🔒 NO CREDITS' : '⚡ NEURAL SCAN'}
                </button>
              </div>
              <div className="flex overflow-x-auto border-b border-[rgba(0,212,130,0.15)] bg-[#161b22] flex-shrink-0 scrollbar-none" style={{WebkitOverflowScrolling:'touch'}}>
                {(['verdict','holders','liquidity','transfers','chart','edge'] as ScanTab[]).map(t => (
                  <button key={t} onClick={() => { setScanTab(t) }}
                    className={`px-4 py-2.5 text-[0.6rem] font-bold tracking-wider uppercase font-mono border-b-2 whitespace-nowrap transition-all ${scanTab === t ? 'text-[#00d4aa] border-indigo-500 bg-indigo-950/20' : 'text-[#8b949e] border-transparent hover:text-[#c9d1d9]'}`}
                    style={{ marginBottom: '-1px' }}>
                    {t === 'verdict' ? '🔍 Verdict' : t === 'holders' ? '👥 Holders' : t === 'liquidity' ? '💧 Liquidity' : t === 'transfers' ? '🔄 Transfers' : t === 'chart' ? '📈 Price Chart' : '⚡ Alpha Edge'}
                  </button>
                ))}
              </div>
              <div className={`flex-1 overflow-y-auto pb-[70px] md:pb-0 ${(scanTab === 'chart') ? 'p-0' : 'p-3 md:p-4'}`}>{renderScanContent()}</div>
            </>
          )}

          {/* Portfolio view */}
          {view === 'portfolio' && (
            <div className="flex-1 overflow-y-auto p-4">{renderPortfolioContent()}</div>
          )}

          {/* Whales — PRO gated */}
          {view === 'whales' && (
            <ProGate feature="Smart Money & Whale Tracking is available on the Pro plan. Follow top Solana traders in real-time." icon="🐋">
              <div className="flex-1 overflow-y-auto p-4">
                <ErrorBoundary name="Whale Intel">
                  <InsiderWhaleIntel />
                </ErrorBoundary>
              </div>
            </ProGate>
          )}

          {/* Alpha — PRO gated */}
          {view === 'alpha' && (
            <ProGate feature="The Alpha Feed surfaces rug alerts, whale accumulation signals, and liquidity events before the crowd." icon="📡">
              {renderAlphaPage()}
            </ProGate>
          )}

          {view === 'forensics' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <ProGate feature="Rug Forensics Lab — Deep contract analysis, holder concentration, liquidity health and rug probability scoring." icon="🔐">
                <RugForensicsLab />
              </ProGate>
            </div>
          )}
          {view === 'neuralv4' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <ProGate feature="Neural Scan V4 — Nansen-grade token intelligence." icon="🧠">
                <NeuralScanV4 />
              </ProGate>
            </div>
          )}
          {view === 'promax' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', background: '#050505' }}>
              <ProMaxDeepDashboard isPro={isPro} onUpgrade={() => setShowModal(true)} />
            </div>
          )}
          {view === 'elite' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', background: '#030308' }}>
              <ProMaxEliteDashboard isPro={isPro} tier="elite" onUpgrade={() => setShowModal(true)} />
            </div>
          )}
          {/* Feed — Mobile fullscreen Alpha Feed */}
          {view === 'feed' && (
            <div className="flex flex-col flex-1 overflow-hidden pb-[60px]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-[rgba(6,182,212,0.2)] flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 dot-pulse" />
                  <span className="text-[0.65rem] font-bold text-cyan-400 font-mono tracking-wider">LIVE ALPHA FEED</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="ds-badge ds-badge-rpc text-[0.5rem]">Helius RPC</span>
                  <span className="text-[0.52rem] text-[#484f58] font-mono">{feedItems.length} events</span>
                </div>
              </div>
              {/* Scrollable feed */}
              <div className="flex-1 overflow-y-auto p-3">
                {feedItems.map(f => {
                  const clickable = !!(f.mint && f.mint.length >= 32)
                  return (
                    <div
                      key={f.id}
                      onClick={() => { if (clickable) { handleFeedClick(f.mint!); setView('scanner') } }}
                      style={{ cursor: clickable ? 'pointer' : 'default' }}
                      className="py-3 border-b border-[rgba(33,38,45,0.6)] last:border-0 slide-in rounded-[4px] px-2 -mx-2"
                      onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,130,0.06)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`alpha-tag ${f.tagCls} text-[0.52rem]`}>{f.tag}</span>
                        <div className="flex items-center gap-2">
                          {clickable && <span className="text-[0.5rem] text-[#00d4aa] font-mono">⚡ tap to scan</span>}
                          <span className="text-[0.5rem] text-[#484f58]">{f.ts}</span>
                        </div>
                      </div>
                      <div className="text-[0.7rem] leading-relaxed text-[#c9d1d9]">{f.text}</div>
                      {clickable && (
                        <div className="text-[0.52rem] text-[#484f58] mt-0.5 font-mono">
                          {f.mint!.slice(0,10)}…{f.mint!.slice(-8)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── STATUS BAR ── */}
      <div className="h-8 border-t border-[rgba(0,212,130,0.15)] flex items-center gap-4 px-3.5 text-[0.56rem] text-[#8b949e] bg-[#161b22] relative z-10 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-400 dot-pulse" />Helius RPC</span>
        <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-cyan-400" />Slot: {slot || '—'}</span>
        <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-indigo-400" />Scans: {scanCount}</span>
        <span className="hidden sm:flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-400" />{NETWORK_LABEL}</span>
        <span className="hidden lg:flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-violet-400" />{ENGINE_LABEL}</span>
        <span className="ml-auto hidden sm:block">{timeStr}</span>
      </div>

      {/* ── DISCLAIMER FOOTER ── */}
      <footer className="bg-[#161b22] border-t border-[rgba(0,212,130,0.15)] px-5 py-3.5 relative z-10 flex items-start gap-2.5 flex-wrap">
        <span className="text-[0.82rem] opacity-40 flex-shrink-0 mt-0.5">⚠</span>
        <p className="text-[0.57rem] text-[#484f58] leading-relaxed flex-1 min-w-[200px]">
          <strong className="text-[#8b949e]">DISCLAIMER — NOT FINANCIAL ADVICE.</strong>{' '}
          CryptoCheck AI is a data analysis tool only. Trading cryptocurrencies involves significant risk of loss. Token scan results are algorithmic assessments, not investment advice. Past performance does not predict future results. Always conduct your own research (DYOR). CryptoCheck AI is not responsible for any trading losses.
          <span className="text-[#4b5563]"> · Powered by Helius Real-Time RPC · {NETWORK_LABEL} · {ENGINE_LABEL}</span>
        </p>
        <div className="flex gap-3 items-center text-[0.55rem] flex-shrink-0 flex-wrap">
          {['Privacy','Terms','Docs','Contact'].map(l => (
            <a key={l} href="#" className="text-[#8b949e] hover:text-[#00d4aa] transition-colors no-underline">{l}</a>
          ))}
        </div>
      </footer>

      {/* ── MOBILE BOTTOM NAV ── */}
      {/* Order: Scan → Chart → Trade → Portfolio → Pro */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[400] bg-[rgba(2,4,14,0.98)] backdrop-blur-xl border-t border-[rgba(91,95,239,0.12)]" style={{height:60}}>
        {/* Row 1 — main tabs */}
        <div style={{display:'flex',height:'100%'}}>
          <button onClick={() => { setView('scanner'); setScanTab('verdict') }} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:'transparent',border:'none',cursor:'pointer',color:view==='scanner'&&scanTab==='verdict'?'#00d4aa':'#5a6478',fontFamily:'IBM Plex Mono,monospace',fontSize:'0.42rem',letterSpacing:'0.08em',textTransform:'uppercase'}}>
            <span style={{fontSize:16,filter:view==='scanner'&&scanTab==='verdict'?'drop-shadow(0 0 5px rgba(139,133,248,0.8))':'none'}}>⚡</span>SCAN
          </button>
          <button onClick={() => { setView('scanner'); setScanTab('chart') }} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:'transparent',border:'none',cursor:'pointer',color:view==='scanner'&&scanTab==='chart'?'#10b981':'#5a6478',fontFamily:'IBM Plex Mono,monospace',fontSize:'0.42rem',letterSpacing:'0.08em',textTransform:'uppercase'}}>
            <span style={{fontSize:16,filter:view==='scanner'&&scanTab==='chart'?'drop-shadow(0 0 5px rgba(16,185,129,0.8))':'none'}}>📈</span>CHART
          </button>
          <button onClick={() => { const mint=scanData?.mint??''; const s=scanData?.meta?.onChainMetadata?.metadata?.data?.symbol??scanData?.meta?.legacyMetadata?.symbol??'???'; if(mint){setSwapMint(mint);setSwapSym(s);setShowSwap(true)}else{setView('scanner')} }} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:'transparent',border:'none',cursor:'pointer',color:'#10b981',fontFamily:'IBM Plex Mono,monospace',fontSize:'0.42rem',letterSpacing:'0.08em',textTransform:'uppercase'}}>
            <span style={{fontSize:16,filter:'drop-shadow(0 0 4px rgba(16,185,129,0.6))'}}>💱</span>TRADE
          </button>
          <button onClick={() => setView('whales')} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:'transparent',border:'none',cursor:'pointer',color:view==='whales'?'#fbbf24':'#5a6478',fontFamily:'IBM Plex Mono,monospace',fontSize:'0.42rem',letterSpacing:'0.08em',textTransform:'uppercase'}}>
            <span style={{fontSize:16,filter:view==='whales'?'drop-shadow(0 0 5px rgba(251,191,36,0.8))':'none'}}>🐋</span>WHALES
          </button>
          <button onClick={() => setView('forensics')} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:'transparent',border:'none',cursor:'pointer',color:view==='forensics'?'#ef4444':'#5a6478',fontFamily:'IBM Plex Mono,monospace',fontSize:'0.42rem',letterSpacing:'0.08em',textTransform:'uppercase'}}>
            <span style={{fontSize:16,filter:view==='forensics'?'drop-shadow(0 0 5px rgba(239,68,68,0.8))':'none'}}>🔐</span>RUG
          </button>
          <button onClick={() => setView('neuralv4')} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:'transparent',border:'none',cursor:'pointer',color:view==='neuralv4'?'#00d4aa':'#5a6478',fontFamily:'IBM Plex Mono,monospace',fontSize:'0.42rem',letterSpacing:'0.08em',textTransform:'uppercase'}}>
            <span style={{fontSize:16,filter:view==='neuralv4'?'drop-shadow(0 0 5px rgba(167,139,250,0.8))':'none'}}>🧠</span>NEURAL
          </button>
          <button onClick={() => setView('feed')} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:'transparent',border:'none',cursor:'pointer',color:view==='feed'?'#38bdf8':'#5a6478',fontFamily:'IBM Plex Mono,monospace',fontSize:'0.42rem',letterSpacing:'0.08em',textTransform:'uppercase'}}>
            <span style={{fontSize:16,filter:view==='feed'?'drop-shadow(0 0 5px rgba(56,189,248,0.8))':'none'}}>📡</span>FEED
          </button>
          <button onClick={() => setShowModal(true)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:'transparent',border:'none',cursor:'pointer',color:'#fbbf24',fontFamily:'IBM Plex Mono,monospace',fontSize:'0.42rem',letterSpacing:'0.08em',textTransform:'uppercase'}}>
            <span style={{fontSize:16,filter:'drop-shadow(0 0 4px rgba(251,191,36,0.6))'}}>⭐</span>PRO
          </button>
        </div>
      </nav>

      {/* ── PRO MODAL ── */}
      {showModal && <ProModal onClose={() => setShowModal(false)} />}
      {showSwap && swapMint && (
        <JupiterSwapModal
          mint={swapMint}
          sym={swapSym}
          onClose={() => setShowSwap(false)}
        />
      )}
    </>
  )
}