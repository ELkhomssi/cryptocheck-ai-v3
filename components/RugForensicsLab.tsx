'use client'
import { useState, useCallback } from 'react'

interface EvidenceItem {
  id: string
  type: 'RUG_SIGNAL' | 'WARNING' | 'CLEAN' | 'INFO'
  title: string
  description: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN'
  timestamp: string
  data?: Record<string, unknown>
}

interface ForensicsResult {
  mint: string
  name: string
  symbol: string
  mintAuth: string | null
  forensicsScore: number
  rugProbability: number
  verdict: string
  verdictColor: string
  evidence: EvidenceItem[]
  marketData: {
    price: string
    liquidity: number
    volume24h: number
    priceChange24h: number
    dexUrl: string
  } | null
  holderStats: {
    topHolders: Array<{ address: string; uiAmount: number }>
    totalSupply: string
  } | null
  scannedAt: string
  engine: string
}

function severityColor(s: string) {
  switch (s) {
    case 'CRITICAL': return '#ef4444'
    case 'HIGH':     return '#f59e0b'
    case 'MEDIUM':   return '#38bdf8'
    case 'CLEAN':    return '#22c55e'
    default:         return '#6b7280'
  }
}

function typeIcon(t: string) {
  switch (t) {
    case 'RUG_SIGNAL': return '🚨'
    case 'WARNING':    return '⚠️'
    case 'CLEAN':      return '✅'
    default:           return 'ℹ️'
  }
}

function RadialGauge({ value, color }: { value: number; color: string }) {
  const r = 54, circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x="70" y="65" textAnchor="middle" fill={color} fontSize="24" fontWeight="700" fontFamily="monospace">{value}</text>
      <text x="70" y="82" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">RUG PROB %</text>
    </svg>
  )
}

export default function RugForensicsLab() {
  const [mint, setMint]       = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<ForensicsResult | null>(null)
  const [error, setError]     = useState('')
  const [step, setStep]       = useState('')

  const runForensics = useCallback(async () => {
    if (!mint.trim() || mint.trim().length < 32) { setError('Please enter a valid Solana token address'); return }
    setLoading(true); setError(''); setResult(null)

    const steps = [
      '📋 Fetching on-chain metadata…',
      '🐋 Analyzing holder distribution…',
      '💧 Checking liquidity pools…',
      '📊 Scanning transaction history…',
      '🧠 Running Neural Forensics Engine v4…',
      '⚖️ Computing rug probability…',
    ]
    let i = 0
    const iv = setInterval(() => { if (i < steps.length) { setStep(steps[i]); i++ } }, 500)

    try {
      const res  = await fetch('/api/forensics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: mint.trim() }),
      })
      const data = await res.json()
      clearInterval(iv)
      if (data.error) { setError(data.error); setLoading(false); return }
      setResult(data)
    } catch { setError('Forensics scan failed. Check connection.') }
    finally  { clearInterval(iv); setLoading(false); setStep('') }
  }, [mint])

  return (
    <div style={{ color: '#e6edf3', fontFamily: '"IBM Plex Mono", monospace', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(239,68,68,0.2)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(239,68,68,0.04)' }}>
        <div style={{ fontSize: '20px' }}>🔐</div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', color: '#ef4444' }}>RUG FORENSICS LAB</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Neural Forensics Engine v4 · Deep Contract Analysis</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
          <span style={{ fontSize: '9px', color: '#ef4444', letterSpacing: '0.1em' }}>ACTIVE</span>
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', letterSpacing: '0.1em' }}>TOKEN ADDRESS TO INVESTIGATE</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={mint} onChange={e => setMint(e.target.value)} onKeyDown={e => e.key === 'Enter' && runForensics()}
            placeholder="Paste Solana mint address…"
            style={{ flex: 1, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '10px 12px', color: '#e6edf3', fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', outline: 'none' }} />
          <button onClick={runForensics} disabled={loading}
            style={{ background: loading ? 'rgba(239,68,68,0.2)' : '#ef4444', border: 'none', borderRadius: '4px', padding: '10px 20px', color: '#fff', fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
            {loading ? '⟳ SCANNING…' : '🔍 INVESTIGATE'}
          </button>
        </div>
        {error && <div style={{ marginTop: '8px', fontSize: '10px', color: '#ef4444' }}>❌ {error}</div>}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '24px 20px' }}>
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px', padding: '20px' }}>
            <div style={{ fontSize: '10px', color: '#ef4444', marginBottom: '12px', letterSpacing: '0.1em' }}>FORENSICS SCAN IN PROGRESS</div>
            {['📋 Fetching on-chain metadata…','🐋 Analyzing holder distribution…','💧 Checking liquidity pools…','📊 Scanning transaction history…','🧠 Running Neural Forensics Engine v4…','⚖️ Computing rug probability…'].map((s, i) => (
              <div key={i} style={{ fontSize: '10px', color: step === s ? '#ef4444' : 'rgba(255,255,255,0.2)', padding: '3px 0', transition: 'color 0.3s' }}>
                {step === s ? '▶ ' : '  '}{s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Verdict */}
          <div style={{ background: `${result.verdictColor}15`, border: `1px solid ${result.verdictColor}40`, borderRadius: '6px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <RadialGauge value={result.rugProbability} color={result.verdictColor} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: '6px' }}>FORENSICS VERDICT</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: result.verdictColor, marginBottom: '4px' }}>{result.verdict}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{result.name} (${result.symbol}) · Score: {result.forensicsScore}/100</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>{result.engine} · {new Date(result.scannedAt).toLocaleTimeString()}</div>
            </div>
          </div>

          {/* Evidence */}
          <div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: '8px' }}>EVIDENCE LOG — {result.evidence.length} ITEMS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {result.evidence.map(item => (
                <div key={item.id} style={{ background: `${severityColor(item.severity)}08`, border: `1px solid ${severityColor(item.severity)}25`, borderLeft: `3px solid ${severityColor(item.severity)}`, borderRadius: '4px', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span>{typeIcon(item.type)}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: severityColor(item.severity) }}>{item.title}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '8px', color: severityColor(item.severity), background: `${severityColor(item.severity)}15`, padding: '2px 6px', borderRadius: '2px' }}>{item.severity}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{item.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Market Data */}
          {result.marketData && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: '10px' }}>MARKET FORENSICS DATA</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Price', value: `$${Number(result.marketData.price||0).toFixed(8)}` },
                  { label: 'Liquidity', value: `$${Number(result.marketData.liquidity||0).toLocaleString()}` },
                  { label: '24h Volume', value: `$${Number(result.marketData.volume24h||0).toLocaleString()}` },
                  { label: '24h Change', value: `${result.marketData.priceChange24h?.toFixed(2)}%`, color: (result.marketData.priceChange24h||0) >= 0 ? '#22c55e' : '#ef4444' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: item.color || '#e6edf3' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {result.marketData.dexUrl && (
                <a href={result.marketData.dexUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '10px', fontSize: '9px', color: '#38bdf8', textDecoration: 'none' }}>→ View on DexScreener</a>
              )}
            </div>
          )}

          {/* Top Holders */}
          {result.holderStats && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: '10px' }}>TOP HOLDERS — FORENSICS BREAKDOWN</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {result.holderStats.topHolders.slice(0, 5).map((h, i) => {
                  const total = result.holderStats!.topHolders.reduce((a, b) => a + b.uiAmount, 0)
                  const pct = total > 0 ? ((h.uiAmount / total) * 100).toFixed(1) : '0'
                  return (
                    <div key={h.address} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', width: '14px' }}>#{i+1}</span>
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', flex: 1 }}>{h.address.slice(0,8)}…{h.address.slice(-6)}</span>
                      <div style={{ width: '80px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Number(pct))}%`, height: '100%', background: Number(pct) > 30 ? '#ef4444' : '#22c55e', borderRadius: '2px' }} />
                      </div>
                      <span style={{ fontSize: '9px', color: Number(pct) > 30 ? '#ef4444' : '#22c55e', width: '36px', textAlign: 'right' }}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {result.engine} · Not financial advice · Always DYOR
          </div>
        </div>
      )}

      {/* Empty State */}
      {!result && !loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔐</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Rug Forensics Lab Ready</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', maxWidth: '280px', margin: '0 auto', lineHeight: 1.6 }}>
            Paste any Solana token address to run deep forensics — mint authority, holder concentration, liquidity health, and rug probability.
          </div>
        </div>
      )}
    </div>
  )
}
