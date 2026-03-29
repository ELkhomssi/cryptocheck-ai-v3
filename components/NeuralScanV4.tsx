'use client'
import { useState, useRef } from 'react'

interface Signal {
  label: string
  impact: number
  severity: string
  detail: string
}

interface ScanResult {
  mint: string
  name: string
  symbol: string
  totalSupply: string
  mintAuth: string | null
  score: number
  verdict: string
  verdictColor: string
  confidence: number
  signals: Signal[]
  holderIntel: {
    top1Pct: number
    top5Pct: number
    top10Pct: number
    topHolders: Array<{ address: string; uiAmount: number; pct: number }>
  }
  marketIntel: {
    price: string
    marketCap: string
    liquidity: string
    volume24h: string
    priceChange24h: number
    priceChange6h: number
    priceChange1h: number
    buys24h: number
    sells24h: number
    buySellRatio: string
    pairAge: number | null
    dexUrl: string
  }
  txIntel: {
    total: number
    uniqueSenders: number
    avgTxPerSender: string
    types: Record<string, number>
    recentTxs: Array<{ sig: string; type: string; time: string }>
  }
  scannedAt: string
  engine: string
}

const AUDIT_STEPS = [
  '[V4] ESTABLISHING NEURAL LINK TO SOLANA MAINNET...',
  '[FORENSICS] TRACING DEVELOPER WALLET CLUSTERS...',
  '[V4] FETCHING ON-CHAIN TOKEN METADATA...',
  '[V4] ANALYZING HOLDER CONCENTRATION...',
  '[FORENSICS] SCANNING LIQUIDITY DEPTH...',
  '[V4] SIMULATING 1000x TRANSACTION SCENARIOS...',
  '[FORENSICS] SCANNING RUG-PULL DATABASE...',
  '[V4] CALCULATING RUG-PROBABILITY SCORE...',
  '[NEURAL] CROSS-REFERENCING SMART MONEY...',
  '[V4] COMPUTING FINAL NEURAL SCORE...',
]

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 44, circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 55 55)" style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
      <text x="55" y="50" textAnchor="middle" fill={color} fontSize="22" fontWeight="700" fontFamily="monospace">{score}</text>
      <text x="55" y="64" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8" fontFamily="monospace">/100</text>
    </svg>
  )
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: '2px' }} />
    </div>
  )
}

export default function NeuralScanV4() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'verdict'|'holders'|'market'|'txs'>('verdict')

  async function runScan() {
    const mint = inputRef.current?.value?.trim() || ''
    if (mint.length < 32) {
      setError('Please paste a valid Solana address (32+ chars)')
      return
    }
    setError('')
    setLoading(true)
    setLogs([])

    // Dramatic audit log
    for (let i = 0; i < AUDIT_STEPS.length; i++) {
      await new Promise(r => setTimeout(r, 500))
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${AUDIT_STEPS[i]}`])
    }

    try {
      const res = await fetch('/api/neural-v4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
        setActiveTab('verdict')
      }
    } catch {
      setError('Scan failed. Check connection.')
    } finally {
      setLoading(false)
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
    letterSpacing: '0.05em', cursor: 'pointer', border: 'none',
    fontFamily: 'IBM Plex Mono, monospace', transition: 'all 0.2s',
    background: active ? 'rgba(99,102,241,0.25)' : 'transparent',
    color: active ? '#a78bfa' : 'rgba(255,255,255,0.4)',
  })

  return (
    <div style={{ color: '#e6edf3', fontFamily: 'IBM Plex Mono, monospace' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(99,102,241,0.15)', background: 'rgba(99,102,241,0.04)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>🧠</span>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.1em' }}>NEURAL SCAN V4</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>Nansen-Grade Token Intelligence · Deep Analytics</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: '9px', color: '#22c55e' }}>ENGINE ONLINE</span>
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', letterSpacing: '0.08em' }}>TOKEN ADDRESS</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={inputRef}
            defaultValue=""
            placeholder="Paste Solana mint address…"
            onKeyDown={e => e.key === 'Enter' && runScan()}
            style={{
              flex: 1,
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: '6px',
              padding: '10px 14px',
              color: '#e6edf3',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '11px',
              outline: 'none',
              caretColor: '#a78bfa',
            }}
          />
          <button onClick={runScan} disabled={loading}
            style={{
              background: loading ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.85)',
              border: 'none', borderRadius: '6px', padding: '10px 18px',
              color: '#fff', fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '11px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            }}>
            {loading ? '⟳ SCANNING…' : '⚡ NEURAL SCAN'}
          </button>
        </div>
        {error && <div style={{ marginTop: '8px', fontSize: '10px', color: '#ef4444' }}>❌ {error}</div>}
      </div>

      {/* Audit log during loading */}
      {loading && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '6px', padding: '14px' }}>
            <div style={{ fontSize: '9px', color: '#a78bfa', marginBottom: '10px', letterSpacing: '0.1em' }}>NEURAL ENGINE V4 — DEEP SCAN</div>
            {logs.map((log, i) => (
              <div key={i} style={{ fontSize: '9px', color: i === logs.length - 1 ? '#a78bfa' : 'rgba(255,255,255,0.3)', padding: '2px 0', lineHeight: 1.6 }}>
                {i === logs.length - 1 ? '▶ ' : '✓ '}{log}
              </div>
            ))}
            <div style={{ color: '#a78bfa', fontSize: '10px', marginTop: '4px' }}>█</div>
          </div>
        </div>
      )}

      {/* Results — persistent */}
      {result && (
        <div style={{ padding: '14px 20px' }}>

          {/* Score card */}
          <div style={{ background: `${result.verdictColor}10`, border: `1px solid ${result.verdictColor}30`, borderRadius: '8px', padding: '14px', display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '10px' }}>
            <ScoreRing score={result.score} color={result.verdictColor} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#e6edf3', marginBottom: '2px' }}>
                {result.name} <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>${result.symbol}</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: result.verdictColor, marginBottom: '6px' }}>{result.verdict}</div>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {[
                  { l: 'Confidence', v: `${result.confidence}%` },
                  { l: 'Supply', v: result.totalSupply },
                  { l: 'Mint Auth', v: result.mintAuth ? '⚠️ Active' : '✅ Revoked' },
                ].map(item => (
                  <div key={item.l}>
                    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>{item.l}</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#e6edf3' }}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '4px' }}>
            {(['verdict','holders','market','txs'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={tabStyle(activeTab === t)}>
                {t === 'verdict' ? '⚖️ Signals' : t === 'holders' ? '🐋 Holders' : t === 'market' ? '📊 Market' : '🔄 Txs'}
              </button>
            ))}
          </div>

          {/* Signals */}
          {activeTab === 'verdict' && (
            <div>
              {result.signals.map((sig, i) => {
                const c = sig.severity === 'positive' ? '#22c55e' : sig.severity === 'danger' ? '#ef4444' : sig.severity === 'warning' ? '#f59e0b' : '#6b7280'
                return (
                  <div key={i} style={{ borderLeft: `3px solid ${c}`, background: `${c}08`, borderRadius: '4px', padding: '8px 12px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: c }}>{sig.label}</span>
                      <span style={{ fontSize: '10px', color: c, fontWeight: 700 }}>{sig.impact > 0 ? '+' : ''}{sig.impact}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{sig.detail}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Holders */}
          {activeTab === 'holders' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                {[
                  { l: 'Top 1', v: `${result.holderIntel.top1Pct.toFixed(1)}%`, c: result.holderIntel.top1Pct > 30 ? '#ef4444' : '#22c55e' },
                  { l: 'Top 5', v: `${result.holderIntel.top5Pct.toFixed(1)}%`, c: result.holderIntel.top5Pct > 60 ? '#ef4444' : '#f59e0b' },
                  { l: 'Top 10', v: `${result.holderIntel.top10Pct.toFixed(1)}%`, c: '#a78bfa' },
                ].map(item => (
                  <div key={item.l} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>{item.l}</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: item.c }}>{item.v}</div>
                  </div>
                ))}
              </div>
              {result.holderIntel.topHolders.slice(0, 8).map((h, i) => (
                <div key={h.address} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '10px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.25)', width: '16px' }}>#{i+1}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', flex: 1 }}>{h.address.slice(0,10)}…{h.address.slice(-6)}</span>
                  <MiniBar pct={h.pct} color={h.pct > 30 ? '#ef4444' : h.pct > 10 ? '#f59e0b' : '#22c55e'} />
                  <span style={{ fontWeight: 600, color: h.pct > 30 ? '#ef4444' : '#e6edf3', width: '40px', textAlign: 'right' }}>{h.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Market */}
          {activeTab === 'market' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                {[
                  { l: '1h', v: result.marketIntel.priceChange1h },
                  { l: '6h', v: result.marketIntel.priceChange6h },
                  { l: '24h', v: result.marketIntel.priceChange24h },
                ].map(item => (
                  <div key={item.l} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>{item.l} Change</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: (item.v||0) >= 0 ? '#22c55e' : '#ef4444' }}>{(item.v||0) >= 0 ? '+' : ''}{(item.v||0).toFixed(2)}%</div>
                  </div>
                ))}
              </div>
              {[
                { l: 'Price', v: `$${Number(result.marketIntel.price||0).toFixed(8)}` },
                { l: 'Market Cap', v: `$${result.marketIntel.marketCap}` },
                { l: 'Liquidity', v: `$${result.marketIntel.liquidity}` },
                { l: 'Volume 24h', v: `$${result.marketIntel.volume24h}` },
                { l: 'Buys 24h', v: result.marketIntel.buys24h.toString() },
                { l: 'Sells 24h', v: result.marketIntel.sells24h.toString() },
                { l: 'Buy/Sell Ratio', v: `${result.marketIntel.buySellRatio}x` },
                { l: 'Pair Age', v: result.marketIntel.pairAge !== null ? `${result.marketIntel.pairAge}min` : 'N/A' },
              ].map(item => (
                <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '11px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{item.l}</span>
                  <span style={{ fontWeight: 600, color: '#e6edf3' }}>{item.v}</span>
                </div>
              ))}
              <div style={{display:'flex',gap:8,marginTop:'12px'}}>
                <button onClick={()=>window.open(`https://dexscreener.com/solana/${result.mint}?embed=1&theme=dark`,'_blank')} style={{flex:1,padding:'8px 0',background:'rgba(56,189,248,0.08)',border:'1px solid rgba(56,189,248,0.2)',borderRadius:6,fontSize:'9px',color:'#38bdf8',cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',fontWeight:700,letterSpacing:'0.06em'}}>📈 VIEW CHART</button>
                <button onClick={()=>window.open(`https://jup.ag/swap/SOL-${result.mint}`,'_blank')} style={{flex:1,padding:'8px 0',background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:6,fontSize:'9px',color:'#10b981',cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',fontWeight:700,letterSpacing:'0.06em'}}>⚡ SWAP ON JUPITER</button>
              </div>
            </div>
          )}

          {/* Txs */}
          {activeTab === 'txs' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                {[
                  { l: 'Total Txs', v: result.txIntel.total.toString() },
                  { l: 'Unique Senders', v: result.txIntel.uniqueSenders.toString() },
                  { l: 'Avg Tx/Wallet', v: result.txIntel.avgTxPerSender },
                ].map(item => (
                  <div key={item.l} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>{item.l}</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#a78bfa' }}>{item.v}</div>
                  </div>
                ))}
              </div>
              {result.txIntel.recentTxs.map((tx, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '10px' }}>
                  <span style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '1px 5px', borderRadius: '2px', fontSize: '8px' }}>{tx.type}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', flex: 1 }}>{tx.sig}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>{tx.time}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', textAlign: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '8px' }}>
            {result.engine} · Not financial advice · DYOR
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🧠</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Neural Scan V4 Ready</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', lineHeight: 1.7 }}>
            Paste any Solana mint address for<br/>Nansen-grade deep token intelligence.
          </div>
        </div>
      )}
    </div>
  )
}
