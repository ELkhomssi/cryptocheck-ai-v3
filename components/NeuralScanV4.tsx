'use client'
import { useState, useCallback } from 'react'

interface Signal {
  label: string
  impact: number
  severity: 'positive' | 'warning' | 'danger' | 'neutral'
  detail: string
}

interface ScanResult {
  mint: string
  name: string
  symbol: string
  decimals: number
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
    totalHolders: number
    topHolders: Array<{ address: string; uiAmount: number; pct: number }>
  }
  marketIntel: {
    price: string
    marketCap: string
    fdv: string
    liquidity: string
    liquidityRaw: number
    volume24h: string
    volume6h: string
    volume1h: string
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
    recentTxs: Array<{ sig: string; type: string; time: string; feePayer: string }>
  }
  scannedAt: string
  engine: string
}

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

function PriceChange({ val }: { val: number }) {
  const c = val >= 0 ? '#22c55e' : '#ef4444'
  return <span style={{ color: c, fontWeight: 600 }}>{val >= 0 ? '+' : ''}{val.toFixed(2)}%</span>
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.8s ease' }} />
    </div>
  )
}

const SCAN_STEPS = [
  '🔗 Connecting to Helius RPC…',
  '📋 Fetching token metadata…',
  '🐋 Analyzing holder distribution…',
  '💧 Scanning liquidity pools (DexScreener)…',
  '📊 Reading transaction history…',
  '🧠 Running Neural Engine v4…',
  '⚖️ Computing risk signals…',
  '✅ Finalizing report…',
]

export default function NeuralScanV4() {
  const [mint, setMint]       = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<ScanResult | null>(null)
  const [error, setError]     = useState('')
  const [step, setStep]       = useState('')
  const [activeTab, setActiveTab] = useState<'verdict'|'holders'|'market'|'txs'>('verdict')

  const scan = useCallback(async () => {
    const m = mint.trim()
    if (!m || m.length < 32) { setError('Enter a valid Solana token address (32-44 chars)'); return }
    setLoading(true); setError(''); setResult(null); setActiveTab('verdict')

    let i = 0
    const iv = setInterval(() => { if (i < SCAN_STEPS.length) { setStep(SCAN_STEPS[i]); i++ } }, 350)

    try {
      const res  = await fetch('/api/neural-v4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: m }),
      })
      const data = await res.json()
      clearInterval(iv)
      if (data.error) { setError(data.error); setLoading(false); return }
      setResult(data)
    } catch { setError('Scan failed. Check your connection.') }
    finally  { clearInterval(iv); setLoading(false); setStep('') }
  }, [mint])

  const S: Record<string, React.CSSProperties> = {
    wrap:    { color: '#e6edf3', fontFamily: '"IBM Plex Mono", monospace', minHeight: '100%' },
    hdr:     { borderBottom: '1px solid rgba(99,102,241,0.15)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(99,102,241,0.04)' },
    section: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '14px 16px', marginBottom: '10px' },
    label:   { fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '6px' },
    val:     { fontSize: '14px', fontWeight: 700, color: '#e6edf3' },
    tab:     (active: boolean): React.CSSProperties => ({ padding: '6px 14px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', cursor: 'pointer', border: 'none', fontFamily: '"IBM Plex Mono", monospace', transition: 'all 0.2s', background: active ? 'rgba(99,102,241,0.25)' : 'transparent', color: active ? '#a78bfa' : 'rgba(255,255,255,0.4)' }),
  }

  return (
    <div style={S.wrap}>

      {/* Header */}
      <div style={S.hdr}>
        <div style={{ fontSize: '18px' }}>🧠</div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: '#a78bfa' }}>NEURAL SCAN V4</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>Deep Token Intelligence · Nansen-Grade Analytics</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: '9px', color: '#22c55e', letterSpacing: '0.08em' }}>ENGINE ONLINE</span>
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={S.label}>TOKEN ADDRESS</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={mint} onChange={e => setMint(e.target.value)} onKeyDown={e => e.key === 'Enter' && scan()}
            placeholder="Paste Solana mint address…"
            style={{ flex: 1, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', padding: '9px 12px', color: '#e6edf3', fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', outline: 'none' }} />
          <button onClick={scan} disabled={loading}
            style={{ background: loading ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.8)', border: 'none', borderRadius: '4px', padding: '9px 18px', color: '#fff', fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
            {loading ? '⟳ SCANNING…' : '⚡ NEURAL SCAN'}
          </button>
        </div>
        {error && <div style={{ marginTop: '6px', fontSize: '10px', color: '#ef4444' }}>❌ {error}</div>}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '20px' }}>
          <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '6px', padding: '16px' }}>
            <div style={{ fontSize: '9px', color: '#a78bfa', marginBottom: '10px', letterSpacing: '0.1em' }}>NEURAL ENGINE V4 — SCANNING</div>
            {SCAN_STEPS.map((s, i) => (
              <div key={i} style={{ fontSize: '10px', color: step === s ? '#a78bfa' : 'rgba(255,255,255,0.18)', padding: '2px 0', transition: 'color 0.3s' }}>
                {step === s ? '▶ ' : '  '}{s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div style={{ padding: '14px 20px' }}>

          {/* Score + Verdict */}
          <div style={{ ...S.section, display: 'flex', gap: '16px', alignItems: 'center', borderColor: result.verdictColor + '30' }}>
            <ScoreRing score={result.score} color={result.verdictColor} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#e6edf3', marginBottom: '2px' }}>
                {result.name} <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>${result.symbol}</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: result.verdictColor, marginBottom: '6px' }}>{result.verdict}</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { l: 'Confidence', v: `${result.confidence}%` },
                  { l: 'Supply', v: result.totalSupply },
                  { l: 'Mint Auth', v: result.mintAuth ? '⚠️ Active' : '✅ Revoked' },
                  { l: 'Engine', v: 'v4.0' },
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
              <button key={t} onClick={() => setActiveTab(t)} style={S.tab(activeTab === t)}>
                {t === 'verdict' ? '⚖️ Signals' : t === 'holders' ? '🐋 Holders' : t === 'market' ? '📊 Market' : '🔄 Txs'}
              </button>
            ))}
          </div>

          {/* SIGNALS TAB */}
          {activeTab === 'verdict' && (
            <div>
              <div style={S.label}>NEURAL SIGNALS — {result.signals.length} DETECTED</div>
              {result.signals.map((sig, i) => {
                const c = sig.severity === 'positive' ? '#22c55e' : sig.severity === 'danger' ? '#ef4444' : sig.severity === 'warning' ? '#f59e0b' : '#6b7280'
                return (
                  <div key={i} style={{ background: c + '08', border: `1px solid ${c}20`, borderLeft: `3px solid ${c}`, borderRadius: '4px', padding: '8px 12px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: c }}>{sig.label}</span>
                      <span style={{ fontSize: '10px', color: c, fontWeight: 700 }}>{sig.impact > 0 ? '+' : ''}{sig.impact}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{sig.detail}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* HOLDERS TAB */}
          {activeTab === 'holders' && (
            <div>
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                {[
                  { l: 'Top 1 Holder', v: `${result.holderIntel.top1Pct.toFixed(1)}%`, c: result.holderIntel.top1Pct > 30 ? '#ef4444' : '#22c55e' },
                  { l: 'Top 5 Holders', v: `${result.holderIntel.top5Pct.toFixed(1)}%`, c: result.holderIntel.top5Pct > 60 ? '#ef4444' : '#f59e0b' },
                  { l: 'Top 10 Holders', v: `${result.holderIntel.top10Pct.toFixed(1)}%`, c: result.holderIntel.top10Pct > 80 ? '#ef4444' : '#a78bfa' },
                ].map(item => (
                  <div key={item.l} style={{ ...S.section, textAlign: 'center', marginBottom: 0 }}>
                    <div style={S.label}>{item.l}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: item.c }}>{item.v}</div>
                  </div>
                ))}
              </div>
              {/* Holder list */}
              <div style={S.section}>
                <div style={S.label}>TOP HOLDERS BREAKDOWN</div>
                {result.holderIntel.topHolders.slice(0,8).map((h, i) => (
                  <div key={h.address} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', width: '16px' }}>#{i+1}</span>
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', flex: 1 }}>{h.address.slice(0,10)}…{h.address.slice(-6)}</span>
                    <MiniBar pct={h.pct} color={h.pct > 30 ? '#ef4444' : h.pct > 10 ? '#f59e0b' : '#22c55e'} />
                    <span style={{ fontSize: '10px', fontWeight: 600, color: h.pct > 30 ? '#ef4444' : '#e6edf3', width: '40px', textAlign: 'right' }}>{h.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MARKET TAB */}
          {activeTab === 'market' && (
            <div>
              {/* Price changes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                {[
                  { l: '1h Change', v: result.marketIntel.priceChange1h },
                  { l: '6h Change', v: result.marketIntel.priceChange6h },
                  { l: '24h Change', v: result.marketIntel.priceChange24h },
                ].map(item => (
                  <div key={item.l} style={{ ...S.section, textAlign: 'center', marginBottom: 0 }}>
                    <div style={S.label}>{item.l}</div>
                    <div style={{ fontSize: '16px' }}><PriceChange val={item.v} /></div>
                  </div>
                ))}
              </div>
              {/* Market metrics */}
              <div style={S.section}>
                <div style={S.label}>MARKET METRICS</div>
                {[
                  { l: 'Price',        v: `$${Number(result.marketIntel.price).toFixed(8)}` },
                  { l: 'Market Cap',   v: `$${result.marketIntel.marketCap}` },
                  { l: 'FDV',          v: `$${result.marketIntel.fdv}` },
                  { l: 'Liquidity',    v: `$${result.marketIntel.liquidity}` },
                  { l: 'Volume 24h',   v: `$${result.marketIntel.volume24h}` },
                  { l: 'Volume 6h',    v: `$${result.marketIntel.volume6h}` },
                  { l: 'Volume 1h',    v: `$${result.marketIntel.volume1h}` },
                  { l: 'Buys 24h',     v: result.marketIntel.buys24h.toString() },
                  { l: 'Sells 24h',    v: result.marketIntel.sells24h.toString() },
                  { l: 'Buy/Sell',     v: result.marketIntel.buySellRatio + 'x' },
                  { l: 'Pair Age',     v: result.marketIntel.pairAge !== null ? `${result.marketIntel.pairAge}min` : 'N/A' },
                ].map(item => (
                  <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '11px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{item.l}</span>
                    <span style={{ fontWeight: 600, color: '#e6edf3' }}>{item.v}</span>
                  </div>
                ))}
                {result.marketIntel.dexUrl && (
                  <a href={result.marketIntel.dexUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', marginTop: '10px', fontSize: '9px', color: '#38bdf8', textDecoration: 'none' }}>
                    → View full chart on DexScreener
                  </a>
                )}
              </div>
            </div>
          )}

          {/* TXS TAB */}
          {activeTab === 'txs' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                {[
                  { l: 'Total Txs', v: result.txIntel.total.toString() },
                  { l: 'Unique Senders', v: result.txIntel.uniqueSenders.toString() },
                  { l: 'Avg Tx/Wallet', v: result.txIntel.avgTxPerSender },
                ].map(item => (
                  <div key={item.l} style={{ ...S.section, textAlign: 'center', marginBottom: 0 }}>
                    <div style={S.label}>{item.l}</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#a78bfa' }}>{item.v}</div>
                  </div>
                ))}
              </div>
              <div style={S.section}>
                <div style={S.label}>RECENT TRANSACTIONS</div>
                {result.txIntel.recentTxs.length > 0 ? result.txIntel.recentTxs.map((tx, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '10px' }}>
                    <span style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '1px 5px', borderRadius: '2px', fontSize: '8px' }}>{tx.type}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', flex: 1 }}>{tx.sig}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>{tx.time}</span>
                  </div>
                )) : (
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', padding: '8px 0' }}>No recent transactions found.</div>
                )}
              </div>
              <div style={S.section}>
                <div style={S.label}>TX TYPE BREAKDOWN</div>
                {Object.entries(result.txIntel.types).map(([type, count]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', width: '100px' }}>{type}</span>
                    <MiniBar pct={(count / result.txIntel.total) * 100} color="#a78bfa" />
                    <span style={{ fontSize: '9px', color: '#a78bfa', width: '24px', textAlign: 'right' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '4px' }}>
            {result.engine} · {new Date(result.scannedAt).toLocaleString()} · Not financial advice
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🧠</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Neural Scan V4 Ready</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', maxWidth: '300px', margin: '0 auto', lineHeight: 1.7 }}>
            Nansen-grade token intelligence. Paste any Solana mint address to get deep analytics — score, signals, holder intel, market data, and transaction forensics.
          </div>
        </div>
      )}
    </div>
  )
}
