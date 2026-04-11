'use client'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Shield, Brain, Network, Activity, Zap, AlertTriangle, Eye, Lock, TrendingUp, Wallet, Search, ChevronUp, ChevronDown } from 'lucide-react'

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════
interface ProMaxEliteProps {
  isPro: boolean
  onUpgrade: () => void
}

// ═══════════════════════════════════════════════════
// MOCK DATA GENERATORS
// ═══════════════════════════════════════════════════
const genLiquidityData = () => Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  depth: Math.floor(800 + Math.random() * 400 + Math.sin(i / 3) * 200),
  volume: Math.floor(200 + Math.random() * 300),
}))

const genTransfers = () => [
  { id: 1, from: '7xKP…8gQw', to: 'DeFi…9hWs', amount: '2,450 SOL', token: 'BONK', time: '12s ago', type: 'whale' as const, risk: 'low' as const },
  { id: 2, from: '4qS9…aBhL', to: 'Raydi…Pool', amount: '890 SOL', token: 'WIF', time: '34s ago', type: 'lp' as const, risk: 'med' as const },
  { id: 3, from: 'BotA…3kRf', to: '9xMn…7pKe', amount: '12,500 SOL', token: 'POPCAT', time: '1m ago', type: 'sniper' as const, risk: 'high' as const },
  { id: 4, from: 'Smar…tW3x', to: 'Jup…Swap', amount: '340 SOL', token: 'JUP', time: '2m ago', type: 'whale' as const, risk: 'low' as const },
  { id: 5, from: 'DevW…xRug', to: 'CEX…Dep', amount: '45,000 SOL', token: 'SCAM', time: '3m ago', type: 'rug' as const, risk: 'critical' as const },
  { id: 6, from: '2eoM…ZRp3', to: 'Pool…Lock', amount: '1,200 SOL', token: 'GRASS', time: '4m ago', type: 'lp' as const, risk: 'low' as const },
  { id: 7, from: 'Alph…Hunt', to: 'MEW…Buy', amount: '670 SOL', token: 'MEW', time: '5m ago', type: 'whale' as const, risk: 'med' as const },
  { id: 8, from: 'Clus…Node', to: 'Sybil…Net', amount: '8,900 SOL', token: 'FAKE', time: '6m ago', type: 'rug' as const, risk: 'critical' as const },
]

const NETWORK_NODES = [
  { id: 'dev', x: 50, y: 50, label: 'Dev Wallet', color: '#ff4444', size: 14 },
  { id: 'w1', x: 20, y: 25, label: 'Wallet A', color: '#d4af37', size: 8 },
  { id: 'w2', x: 80, y: 20, label: 'Wallet B', color: '#d4af37', size: 8 },
  { id: 'w3', x: 15, y: 70, label: 'Wallet C', color: '#d4af37', size: 7 },
  { id: 'w4', x: 85, y: 75, label: 'CEX Dep', color: '#20b2aa', size: 10 },
  { id: 'w5', x: 35, y: 85, label: 'Mixer', color: '#ff4444', size: 9 },
  { id: 'w6', x: 70, y: 40, label: 'LP Pool', color: '#20b2aa', size: 10 },
  { id: 'w7', x: 30, y: 40, label: 'Sybil 1', color: '#ff6b35', size: 6 },
  { id: 'w8', x: 60, y: 80, label: 'Sybil 2', color: '#ff6b35', size: 6 },
]
const NETWORK_EDGES = [
  ['dev', 'w1'], ['dev', 'w2'], ['dev', 'w3'], ['dev', 'w6'],
  ['w1', 'w7'], ['w2', 'w6'], ['w3', 'w5'], ['w5', 'w8'],
  ['w6', 'w4'], ['w7', 'w8'], ['w8', 'w4'], ['w1', 'w3'],
]

const FORENSIC_LINES = [
  { level: 'INFO', color: '#20b2aa', msg: 'Initializing Neural Engine v4.0 — deep forensic mode' },
  { level: 'SCAN', color: '#d4af37', msg: 'Decompiling bytecode: 2,847 instructions parsed' },
  { level: 'GNN', color: '#d4af37', msg: 'Graph Neural Network: mapping 847 wallet nodes' },
  { level: 'WARNING', color: '#ff6b35', msg: '142 wallets traced to single entity — Sybil: 94.2%' },
  { level: 'RUG_ALERT', color: '#ff4444', msg: '⚠ EXIT LIQUIDITY DETECTED — LP removal velocity: 12 SOL/s' },
  { level: 'HEURISTIC', color: '#20b2aa', msg: 'Model v3.7: 523,841 contracts evaluated — pattern match' },
  { level: 'CLUSTER', color: '#d4af37', msg: 'Developer linked to 3 previously rugged tokens' },
  { level: 'PREDICT', color: '#ff4444', msg: 'RUG PROBABILITY: 98.4% — recommend immediate exit' },
  { level: 'VERDICT', color: '#00ff88', msg: '█ FORENSIC AUDIT COMPLETE — HIGH RISK — DO NOT BUY' },
  { level: 'INFO', color: '#20b2aa', msg: 'Queuing next contract for analysis...' },
  { level: 'SCAN', color: '#20b2aa', msg: 'Contract Dez…B263: safe archetype (confidence: 91.7%)' },
  { level: 'GNN', color: '#d4af37', msg: 'Wallet distribution healthy — no Sybil clusters' },
  { level: 'INFO', color: '#00ff88', msg: 'LP permanently burned via Raydium — supply locked' },
  { level: 'VERDICT', color: '#00ff88', msg: '█ FORENSIC AUDIT COMPLETE — LOW RISK — Score: 82/100 SAFE' },
]

// ═══════════════════════════════════════════════════
// SVG GAUGE COMPONENT
// ═══════════════════════════════════════════════════
function NeuralGauge({ score, size = 140 }: { score: number; size?: number }) {
  const r = (size - 20) / 2
  const circumference = Math.PI * r
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? '#00ff88' : score >= 40 ? '#d4af37' : '#ff4444'
  const label = score >= 70 ? 'LOW RISK' : score >= 40 ? 'MODERATE' : 'HIGH RISK'

  return (
    <div style={{ position: 'relative', width: size, height: size / 2 + 30 }}>
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff4444" />
            <stop offset="50%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#00ff88" />
          </linearGradient>
          <filter id="gaugeGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Background arc */}
        <path
          d={`M 10 ${size / 2} A ${r} ${r} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M 10 ${size / 2} A ${r} ${r} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none" stroke="url(#gaugeGrad)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          filter="url(#gaugeGlow)"
          style={{ transition: 'stroke-dashoffset 1.5s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// NETWORK GRAPH (Custom SVG)
// ═══════════════════════════════════════════════════
function NetworkGraph() {
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setPulse(p => (p + 1) % NETWORK_EDGES.length), 1500)
    return () => clearInterval(iv)
  }, [])

  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
      <defs>
        <filter id="nodeGlow"><feGaussianBlur stdDeviation="1.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {/* Edges */}
      {NETWORK_EDGES.map(([from, to], i) => {
        const a = NETWORK_NODES.find(n => n.id === from)!
        const b = NETWORK_NODES.find(n => n.id === to)!
        const active = i === pulse
        return (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={active ? '#d4af37' : 'rgba(212,175,55,0.12)'}
            strokeWidth={active ? 0.8 : 0.3}
            style={{ transition: 'all 0.5s' }}
          />
        )
      })}
      {/* Nodes */}
      {NETWORK_NODES.map(n => (
        <g key={n.id} filter="url(#nodeGlow)">
          <circle cx={n.x} cy={n.y} r={n.size / 3} fill={n.color + '30'} stroke={n.color} strokeWidth="0.4" />
          <circle cx={n.x} cy={n.y} r={n.size / 6} fill={n.color} />
          <text x={n.x} y={n.y + n.size / 2 + 3} textAnchor="middle" fontSize="2.5" fill="#6e7681" fontFamily="'IBM Plex Mono',monospace">{n.label}</text>
        </g>
      ))}
    </svg>
  )
}

// ═══════════════════════════════════════════════════
// GLASSMORPHISM CARD
// ═══════════════════════════════════════════════════
function GlassCard({ children, span = 4, className = '' }: { children: React.ReactNode; span?: number; className?: string }) {
  return (
    <div className={className} style={{
      gridColumn: `span ${span}`,
      background: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.03) 0%, rgba(0,0,0,0.4) 70%)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 10,
      padding: 'clamp(12px,2vw,18px)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

function CardHeader({ icon: Icon, title, badge }: { icon: any; title: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={14} color="#d4af37" />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>{title}</span>
      </div>
      {badge && (
        <span style={{ fontSize: 7, fontWeight: 700, color: '#d4af37', padding: '2px 6px', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 3, letterSpacing: '0.08em' }}>{badge}</span>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// SORTABLE TABLE
// ═══════════════════════════════════════════════════
function ForensicTable({ data }: { data: ReturnType<typeof genTransfers> }) {
  const [sortKey, setSortKey] = useState<string>('time')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    let d = data.filter(r => 
      filter === '' || r.token.toLowerCase().includes(filter.toLowerCase()) || r.from.includes(filter) || r.to.includes(filter)
    )
    return d
  }, [data, filter])

  const riskColors: Record<string, string> = { low: '#00ff88', med: '#d4af37', high: '#ff6b35', critical: '#ff4444' }
  const typeColors: Record<string, string> = { whale: '#20b2aa', lp: '#d4af37', sniper: '#8b5cf6', rug: '#ff4444' }

  return (
    <div>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Search size={12} color="#484f58" />
        <input
          value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filter transfers..."
          style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '5px 8px', fontSize: 10, color: '#c9d1d9', fontFamily: "'IBM Plex Mono',monospace", outline: 'none' }}
        />
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 220 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 1 }}>
              {['Type', 'From', 'To', 'Amount', 'Token', 'Time', 'Risk'].map(h => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 8, fontWeight: 700, color: '#484f58', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', animation: `fadeRow 0.3s ease ${i * 0.05}s both` }}>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: typeColors[r.type], padding: '1px 5px', borderRadius: 3, background: typeColors[r.type] + '12', border: `1px solid ${typeColors[r.type]}20`, letterSpacing: '0.06em' }}>{r.type.toUpperCase()}</span>
                </td>
                <td style={{ padding: '6px 8px', color: '#8b949e' }}>{r.from}</td>
                <td style={{ padding: '6px 8px', color: '#8b949e' }}>{r.to}</td>
                <td style={{ padding: '6px 8px', color: '#e2e8f0', fontWeight: 600 }}>{r.amount}</td>
                <td style={{ padding: '6px 8px', color: '#d4af37', fontWeight: 700 }}>{r.token}</td>
                <td style={{ padding: '6px 8px', color: '#484f58' }}>{r.time}</td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: riskColors[r.risk], boxShadow: `0 0 4px ${riskColors[r.risk]}`, animation: r.risk === 'critical' ? 'riskPulse 1s infinite' : 'none' }} />
                    <span style={{ fontSize: 8, color: riskColors[r.risk], fontWeight: 600 }}>{r.risk.toUpperCase()}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// FORENSIC TERMINAL
// ═══════════════════════════════════════════════════
function ForensicTerminal() {
  const [lines, setLines] = useState<typeof FORENSIC_LINES>([])
  const ref = useRef<HTMLDivElement>(null)
  const idx = useRef(0)

  useEffect(() => {
    const iv = setInterval(() => {
      setLines(p => [...p.slice(-20), FORENSIC_LINES[idx.current % FORENSIC_LINES.length]])
      idx.current++
      ref.current?.scrollTo(0, ref.current.scrollHeight)
    }, 1100)
    return () => clearInterval(iv)
  }, [])

  return (
    <div ref={ref} style={{ height: '100%', overflowY: 'auto', padding: '8px 10px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, lineHeight: 2, scrollbarWidth: 'none' }}>
      {lines.map((l, i) => (
        <div key={i} style={{ opacity: i === lines.length - 1 ? 1 : 0.55 }}>
          <span style={{ color: '#252525', marginRight: 6, fontSize: 8 }}>{new Date().toTimeString().slice(0, 8)}</span>
          <span style={{ color: l.color, fontWeight: 700, fontSize: 7, padding: '0px 4px', borderRadius: 2, background: l.color + '11', marginRight: 6, letterSpacing: '0.06em' }}>{l.level}</span>
          <span style={{ color: l.level === 'VERDICT' || l.level === 'RUG_ALERT' ? l.color : '#6e7681' }}>{l.msg}</span>
        </div>
      ))}
      <span style={{ color: '#d4af37', animation: 'blink 1s infinite' }}>█</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// STAT MINI CARD
// ═══════════════════════════════════════════════════
function StatMini({ icon: Icon, label, value, delta, color = '#d4af37' }: { icon: any; label: string; value: string; delta?: string; color?: string }) {
  const pos = delta && !delta.startsWith('-')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '10', border: `1px solid ${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 8, color: '#484f58', letterSpacing: '0.1em', fontWeight: 600 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', fontFamily: "'IBM Plex Mono',monospace" }}>{value}</span>
          {delta && <span style={{ fontSize: 9, color: pos ? '#00ff88' : '#ff4444', fontWeight: 600 }}>{delta}</span>}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════
export default function ProMaxEliteDashboard({ isPro, onUpgrade }: ProMaxEliteProps) {
  const [liquidityData] = useState(genLiquidityData)
  const [transfers] = useState(genTransfers)
  const [neuralScore] = useState(73)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  // ═══ PAYWALL ═══
  if (!isPro) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 'clamp(16px,4vw,40px)', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(212,175,55,0.06) 0%,transparent 60%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <img src="/images/robot-gold.png" alt="Pro Max" style={{ width: 'clamp(180px,30vw,300px)', height: 'auto', margin: '0 auto 20px', display: 'block', borderRadius: 16, filter: 'drop-shadow(0 10px 30px rgba(212,175,55,0.15))' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 16, background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.12)', marginBottom: 16 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#d4af37', boxShadow: '0 0 6px #d4af37' }} />
            <span style={{ fontSize: 9, color: '#d4af37', fontWeight: 700, letterSpacing: '0.1em' }}>PRO MAX NEURAL ENGINE</span>
          </div>
          <h2 style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, color: '#fff', margin: '0 0 8px', fontFamily: "'IBM Plex Mono',monospace" }}>
            Deep Forensic <span style={{ color: '#d4af37' }}>Intelligence</span>
          </h2>
          <p style={{ fontSize: 12, color: '#6e7681', maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.7 }}>
            GNN cluster mapping, predictive rug analysis, unlimited forensic audits. The tools institutional traders use.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 8, background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.12)', marginBottom: 20 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#d4af37' }}>$30</span>
            <div style={{ textAlign: 'left' }}><div style={{ fontSize: 10, color: '#d4af37', fontWeight: 700 }}>/month</div><div style={{ fontSize: 8, color: '#484f58' }}>UNLIMITED · 0% FEES</div></div>
          </div>
          <div>
            <button onClick={onUpgrade} style={{ padding: '14px 32px', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg,#d4af37,#FFD700)', border: 'none', borderRadius: 8, color: '#000', cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", boxShadow: '0 0 30px rgba(212,175,55,0.2)', letterSpacing: '0.03em' }}>
              Upgrade to Pro Max
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══ FULL DASHBOARD ═══
  return (
    <div style={{ padding: 'clamp(8px,2vw,16px)', fontFamily: "'IBM Plex Mono','JetBrains Mono',monospace" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={16} color="#d4af37" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Pro Max <span style={{ color: '#d4af37' }}>Neural</span></span>
          <span style={{ fontSize: 7, fontWeight: 700, color: '#d4af37', padding: '2px 6px', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 3, animation: 'riskPulse 2s infinite' }}>● LIVE</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <StatMini icon={Shield} label="AUDITS TODAY" value="47" delta="+12%" />
          <StatMini icon={AlertTriangle} label="RUGS DETECTED" value="3" delta="" color="#ff4444" />
        </div>
      </div>

      {/* ═══ BENTO GRID ═══ */}
      <div className="promax-bento" style={{ display: 'grid', gap: 10 }}>

        {/* Neural Score Gauge — 4 cols */}
        <GlassCard span={4} className="promax-cell-4">
          <CardHeader icon={Brain} title="Neural Score" badge="LIVE" />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <NeuralGauge score={neuralScore} size={140} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', marginTop: 12 }}>
              {[
                { l: 'Sybil Risk', v: '94.2%', c: '#ff4444' },
                { l: 'LP Health', v: '78%', c: '#d4af37' },
                { l: 'Authority', v: 'ACTIVE', c: '#ff6b35' },
                { l: 'Holders', v: '2,847', c: '#20b2aa' },
              ].map(s => (
                <div key={s.l} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ fontSize: 7, color: '#484f58', letterSpacing: '0.08em' }}>{s.l}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Liquidity Depth Chart — 8 cols */}
        <GlassCard span={8} className="promax-cell-8">
          <CardHeader icon={TrendingUp} title="Liquidity Depth" badge="24H" />
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liquidityData}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4af37" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
                  </linearGradient>
                  <filter id="chartGlow">
                    <feGaussianBlur stdDeviation="2" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#484f58' }} axisLine={{ stroke: 'rgba(255,255,255,0.04)' }} tickLine={false} interval={3} />
                <YAxis tick={{ fontSize: 8, fill: '#484f58' }} axisLine={false} tickLine={false} width={35} />
                <Tooltip
                  contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 6, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }}
                  labelStyle={{ color: '#6e7681' }}
                  itemStyle={{ color: '#d4af37' }}
                />
                <Area type="monotone" dataKey="depth" stroke="#d4af37" strokeWidth={2} fill="url(#goldGrad)" filter="url(#chartGlow)" />
                <Area type="monotone" dataKey="volume" stroke="#20b2aa" strokeWidth={1} fill="rgba(32,178,170,0.05)" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Network Graph — 6 cols */}
        <GlassCard span={6} className="promax-cell-6">
          <CardHeader icon={Network} title="Cluster Map" badge="GNN" />
          <div style={{ height: 200 }}>
            <NetworkGraph />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            {[{ l: 'Nodes', v: '847', c: '#d4af37' }, { l: 'Clusters', v: '12', c: '#ff4444' }, { l: 'Sybil', v: '142', c: '#ff6b35' }].map(s => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: s.c }} />
                <span style={{ fontSize: 8, color: '#484f58' }}>{s.l}:</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: s.c }}>{s.v}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Quick Stats — 6 cols */}
        <GlassCard span={6} className="promax-cell-6">
          <CardHeader icon={Activity} title="Engine Metrics" badge="v4.0" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { icon: Zap, l: 'SCAN SPEED', v: '<0.2s', c: '#20b2aa' },
              { icon: Eye, l: 'CONTRACTS', v: '523K', c: '#d4af37' },
              { icon: Lock, l: 'LP LOCKED', v: '78%', c: '#ff6b35' },
              { icon: Wallet, l: 'WALLETS', v: '847', c: '#d4af37' },
            ].map(s => (
              <div key={s.l} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <s.icon size={14} color={s.c} />
                <div>
                  <div style={{ fontSize: 7, color: '#484f58', letterSpacing: '0.08em' }}>{s.l}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: s.c }}>{s.v}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Forensic Transfers Table — 8 cols */}
        <GlassCard span={8} className="promax-cell-8">
          <CardHeader icon={Activity} title="Live Forensic Transfers" badge="REAL-TIME" />
          <ForensicTable data={transfers} />
        </GlassCard>

        {/* Terminal — 4 cols */}
        <GlassCard span={4} className="promax-cell-4">
          <CardHeader icon={Zap} title="Forensic Log" badge="STREAMING" />
          <div style={{ height: 220, background: '#050505', borderRadius: 6, border: '1px solid rgba(212,175,55,0.06)', overflow: 'hidden' }}>
            <ForensicTerminal />
          </div>
        </GlassCard>

      </div>

      {/* ═══ STYLES ═══ */}
      <style>{`
        @keyframes fadeRow { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes riskPulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        .promax-bento { grid-template-columns: repeat(12,1fr); }
        @media (max-width:900px) {
          .promax-bento { grid-template-columns: 1fr !important; }
          .promax-cell-4, .promax-cell-6, .promax-cell-8 { grid-column: span 1 !important; }
        }
        @media (min-width:901px) and (max-width:1200px) {
          .promax-bento { grid-template-columns: repeat(6,1fr) !important; }
          .promax-cell-4 { grid-column: span 3 !important; }
          .promax-cell-6 { grid-column: span 3 !important; }
          .promax-cell-8 { grid-column: span 6 !important; }
        }
      `}</style>
    </div>
  )
}
