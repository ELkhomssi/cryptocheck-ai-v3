'use client'
import { useState, useRef } from 'react'

interface EvidenceItem {
  id: string
  type: string
  title: string
  description: string
  severity: string
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
  marketData: { price: string; liquidity: number; volume24h: number; priceChange24h: number; dexUrl: string } | null
  scannedAt: string
  engine: string
}

function RadialGauge({ value, color }: { value: number; color: string }) {
  const r = 50, circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 65 65)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x="65" y="60" textAnchor="middle" fill={color} fontSize="22" fontWeight="700" fontFamily="monospace">{value}</text>
      <text x="65" y="76" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">RUG PROB %</text>
    </svg>
  )
}

const SCAN_STEPS = [
  '📋 Fetching on-chain metadata…',
  '🐋 Analyzing holder distribution…',
  '💧 Checking liquidity pools…',
  '📊 Scanning transaction history…',
  '🧠 Running Neural Forensics Engine v4…',
  '⚖️ Computing rug probability…',
]

function severityColor(s: string) {
  if (s === 'CRITICAL') return '#ef4444'
  if (s === 'HIGH') return '#f59e0b'
  if (s === 'MEDIUM') return '#38bdf8'
  if (s === 'CLEAN') return '#22c55e'
  return '#6b7280'
}

export default function RugForensicsLab() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ForensicsResult | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState('')

  async function runScan() {
    const mint = inputRef.current?.value?.trim() || ''
    setError('')
    if (!mint || mint.length < 32 || mint.length > 44) {
      setError('Please paste a valid Solana address (32-44 chars)')
      return
    }
    setResult(null)
    setLoading(true)
    setStep(SCAN_STEPS[0])

    let i = 0
    const iv = setInterval(() => {
      i++
      if (i < SCAN_STEPS.length) setStep(SCAN_STEPS[i])
    }, 500)

    try {
      const res = await fetch('/api/forensics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch {
      setError('Connection failed. Try again.')
    } finally {
      clearInterval(iv)
      setLoading(false)
      setStep('')
    }
  }

  return (
    <div style={{ color: '#e6edf3', fontFamily: 'IBM Plex Mono, monospace' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>🔐</span>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', letterSpacing: '0.1em' }}>RUG FORENSICS LAB</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>Neural Forensics Engine v4 · Deep Contract Analysis</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
          <span style={{ fontSize: '9px', color: '#ef4444' }}>ACTIVE</span>
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', letterSpacing: '0.08em' }}>TOKEN ADDRESS TO INVESTIGATE</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={inputRef}
            defaultValue=""
            placeholder="Paste Solana mint address…"
            onKeyDown={e => e.key === 'Enter' && runScan()}
            style={{
              flex: 1,
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '6px',
              padding: '10px 14px',
              color: '#e6edf3',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '11px',
              outline: 'none',
              caretColor: '#ef4444',
            }}
          />
          <button
            onClick={runScan}
            disabled={loading}
            style={{
              background: loading ? 'rgba(239,68,68,0.3)' : '#ef4444',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 18px',
              color: '#fff',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '11px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? '⟳ SCANNING…' : '🔍 INVESTIGATE'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: '8px', fontSize: '10px', color: '#ef4444' }}>❌ {error}</div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '20px' }}>
          <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px', padding: '16px' }}>
            <div style={{ fontSize: '9px', color: '#ef4444', marginBottom: '10px', letterSpacing: '0.1em' }}>FORENSICS SCAN IN PROGRESS</div>
            {SCAN_STEPS.map((s, i) => (
              <div key={i} style={{ fontSize: '10px', padding: '2px 0', color: step === s ? '#ef4444' : 'rgba(255,255,255,0.18)', transition: 'color 0.3s' }}>
                {step === s ? '▶ ' : '  '}{s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result — always visible once set */}
      {result && (
        <div style={{ padding: '16px 20px' }}>

          {/* Verdict */}
          <div style={{ background: `${result.verdictColor}12`, border: `1px solid ${result.verdictColor}35`, borderRadius: '8px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '12px' }}>
            <RadialGauge value={result.rugProbability} color={result.verdictColor} />
            <div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>FORENSICS VERDICT</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: result.verdictColor, marginBottom: '4px' }}>{result.verdict}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{result.name} (${result.symbol})</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>Forensics Score: {result.forensicsScore}/100</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>{new Date(result.scannedAt).toLocaleTimeString()}</div>
            </div>
          </div>

          {/* Evidence */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginBottom: '8px' }}>EVIDENCE LOG — {result.evidence.length} ITEMS</div>
            {result.evidence.map((item, i) => {
              const c = severityColor(item.severity)
              return (
                <div key={i} style={{ borderLeft: `3px solid ${c}`, background: `${c}08`, borderRadius: '4px', padding: '8px 12px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: c }}>{item.title}</span>
                    <span style={{ fontSize: '8px', color: c, background: `${c}15`, padding: '1px 5px', borderRadius: '2px' }}>{item.severity}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{item.description}</div>
                </div>
              )
            })}
          </div>

          {/* Market */}
          {result.marketData && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginBottom: '10px' }}>MARKET DATA</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Price', value: `$${Number(result.marketData.price||0).toFixed(8)}` },
                  { label: 'Liquidity', value: `$${Number(result.marketData.liquidity||0).toLocaleString()}` },
                  { label: '24h Volume', value: `$${Number(result.marketData.volume24h||0).toLocaleString()}` },
                  { label: '24h Change', value: `${(result.marketData.priceChange24h||0).toFixed(2)}%`, color: (result.marketData.priceChange24h||0) >= 0 ? '#22c55e' : '#ef4444' },
                ].map(m => (
                  <div key={m.label}>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>{m.label}</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: m.color || '#e6edf3' }}>{m.value}</div>
                  </div>
                ))}
              </div>
              {result.marketData.dexUrl && (
                <a href={result.marketData.dexUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '8px', fontSize: '9px', color: '#38bdf8', textDecoration: 'none' }}>→ View on DexScreener</a>
              )}
            </div>
          )}

          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', textAlign: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {result.engine} · Not financial advice · DYOR
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔐</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Rug Forensics Lab Ready</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', lineHeight: 1.7 }}>
            Paste any Solana token address to run deep forensics.<br/>
            Mint authority · Holder concentration · Liquidity health
          </div>
        </div>
      )}
    </div>
  )
}
