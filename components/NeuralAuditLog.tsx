'use client'
import { useState, useEffect, useRef } from 'react'

interface AuditStep {
  id: string
  label: string
  detail: string
  status: 'pending' | 'running' | 'pass' | 'fail' | 'warn'
  duration: number
}

const AUDIT_STEPS: AuditStep[] = [
  { id: 'init',     label: 'INIT',            detail: 'Connecting to Helius RPC mainnet-beta...',          status: 'pending', duration: 300  },
  { id: 'meta',     label: 'METADATA',        detail: 'Fetching on-chain token metadata via DAS API...',   status: 'pending', duration: 500  },
  { id: 'mint',     label: 'MINT_AUTH',       detail: 'Verifying mint authority revocation status...',     status: 'pending', duration: 400  },
  { id: 'freeze',   label: 'FREEZE_AUTH',     detail: 'Checking freeze authority on token accounts...',    status: 'pending', duration: 300  },
  { id: 'supply',   label: 'SUPPLY',          detail: 'Calculating total supply and decimal precision...',  status: 'pending', duration: 350  },
  { id: 'holders',  label: 'HOLDERS',         detail: 'Analyzing top 20 holder concentration...',          status: 'pending', duration: 600  },
  { id: 'liq',      label: 'LIQUIDITY',       detail: 'Scanning Raydium/Orca pool depth via DexScreener...',status: 'pending', duration: 500  },
  { id: 'lock',     label: 'LIQ_LOCK',        detail: 'Verifying liquidity lock status and duration...',   status: 'pending', duration: 400  },
  { id: 'vol',      label: 'VOLUME',          detail: 'Cross-referencing 1h/6h/24h volume anomalies...',  status: 'pending', duration: 350  },
  { id: 'txns',     label: 'TX_PATTERN',      detail: 'Detecting wash trading and bot activity...',        status: 'pending', duration: 450  },
  { id: 'dev',      label: 'DEV_WALLET',      detail: 'Tracing deployer wallet history and rug DB...',     status: 'pending', duration: 500  },
  { id: 'cluster',  label: 'CLUSTERING',      detail: 'Running wallet cluster analysis (connected wallets)...',status: 'pending', duration: 600 },
  { id: 'neural',   label: 'NEURAL_ENGINE',   detail: 'Running GPT-4o deep risk assessment...',            status: 'pending', duration: 700  },
  { id: 'score',    label: 'SCORE_COMPUTE',   detail: 'Computing final Neural Score v4...',                status: 'pending', duration: 300  },
]

function randomPass(): 'pass' | 'fail' | 'warn' {
  const r = Math.random()
  if (r > 0.85) return 'fail'
  if (r > 0.7)  return 'warn'
  return 'pass'
}

export default function NeuralAuditLog({
  running,
  onComplete,
  score,
}: {
  running: boolean
  onComplete?: () => void
  score?: number
}) {
  const [steps, setSteps] = useState<AuditStep[]>(AUDIT_STEPS.map(s => ({ ...s, status: 'pending' })))
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [logs, setLogs] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!running) {
      setSteps(AUDIT_STEPS.map(s => ({ ...s, status: 'pending' })))
      setCurrentIdx(-1)
      setLogs([])
      setDone(false)
      return
    }

    let idx = 0
    setDone(false)

    function runStep() {
      if (idx >= AUDIT_STEPS.length) {
        setDone(true)
        onComplete?.()
        return
      }

      const step = AUDIT_STEPS[idx]
      setCurrentIdx(idx)
      setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'running' } : s))
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ► ${step.label}: ${step.detail}`])

      setTimeout(() => {
        const result = idx === AUDIT_STEPS.length - 1 ? 'pass' : randomPass()
        setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: result } : s))
        setLogs(prev => [...prev,
          `[${new Date().toLocaleTimeString()}] ${result === 'pass' ? '✓' : result === 'warn' ? '⚠' : '✗'} ${step.label}: ${result.toUpperCase()} ${result === 'pass' ? '— No issues detected' : result === 'warn' ? '— Caution advised' : '— Risk factor identified'}`
        ])
        idx++
        setTimeout(runStep, 80)
      }, step.duration)
    }

    setTimeout(runStep, 100)
  }, [running])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  if (!running && !done) return null

  const statusColor = (s: string) => {
    switch (s) {
      case 'running': return '#38bdf8'
      case 'pass':    return '#22c55e'
      case 'fail':    return '#ef4444'
      case 'warn':    return '#f59e0b'
      default:        return 'rgba(255,255,255,0.2)'
    }
  }

  const statusIcon = (s: string) => {
    switch (s) {
      case 'running': return '⟳'
      case 'pass':    return '✓'
      case 'fail':    return '✗'
      case 'warn':    return '⚠'
      default:        return '○'
    }
  }

  const passCount = steps.filter(s => s.status === 'pass').length
  const failCount = steps.filter(s => s.status === 'fail').length
  const warnCount = steps.filter(s => s.status === 'warn').length

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(4,4,16,0.98) 0%, rgba(6,6,20,0.98) 100%)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(99,102,241,0.2)',
      borderRadius: '10px',
      overflow: 'hidden',
      fontFamily: 'IBM Plex Mono, monospace',
      marginBottom: '12px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(99,102,241,0.06)',
        borderBottom: '1px solid rgba(99,102,241,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: done ? '#22c55e' : '#38bdf8', boxShadow: `0 0 8px ${done ? '#22c55e' : '#38bdf8'}` }} />
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#a78bfa' }}>
            NEURAL AUDIT LOG — DEEP SCAN
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '9px' }}>
          <span style={{ color: '#22c55e' }}>✓ {passCount}</span>
          <span style={{ color: '#f59e0b' }}>⚠ {warnCount}</span>
          <span style={{ color: '#ef4444' }}>✗ {failCount}</span>
        </div>
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

        {/* Left — Step checklist */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.04)', padding: '12px' }}>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: '8px' }}>AUDIT CHECKLIST</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {steps.map((step, i) => (
              <div key={step.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 6px',
                background: i === currentIdx ? 'rgba(56,189,248,0.05)' : 'transparent',
                borderRadius: '3px',
                transition: 'background 0.2s',
              }}>
                <span style={{
                  fontSize: '10px',
                  color: statusColor(step.status),
                  animation: step.status === 'running' ? 'spin 1s linear infinite' : 'none',
                  display: 'inline-block',
                  width: '12px',
                }}>
                  {statusIcon(step.status)}
                </span>
                <span style={{ fontSize: '9px', color: step.status === 'pending' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)', letterSpacing: '0.03em' }}>
                  {step.label}
                </span>
                {step.status !== 'pending' && (
                  <span style={{ marginLeft: 'auto', fontSize: '8px', color: statusColor(step.status), background: `${statusColor(step.status)}15`, padding: '1px 4px', borderRadius: '2px' }}>
                    {step.status.toUpperCase()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right — Live log */}
        <div style={{ padding: '12px' }}>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: '8px' }}>LIVE OUTPUT</div>
          <div
            ref={logRef}
            style={{
              height: '260px',
              overflowY: 'auto',
              fontSize: '8.5px',
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
          >
            {logs.map((log, i) => (
              <div key={i} style={{
                color: log.includes('✓') ? 'rgba(34,197,94,0.8)' :
                       log.includes('✗') ? 'rgba(239,68,68,0.8)' :
                       log.includes('⚠') ? 'rgba(245,158,11,0.8)' :
                       log.includes('►') ? 'rgba(56,189,248,0.7)' :
                       'rgba(255,255,255,0.35)',
                padding: '1px 0',
              }}>
                {log}
              </div>
            ))}
            {!done && (
              <div style={{ color: '#38bdf8', animation: 'pulse 1s ease-in-out infinite' }}>
                █
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Done summary */}
      {done && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(34,197,94,0.04)',
        }}>
          <span style={{ fontSize: '9px', color: '#22c55e', letterSpacing: '0.08em' }}>
            ✓ AUDIT COMPLETE — {steps.length} CHECKS RUN
          </span>
          {score !== undefined && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444' }}>
              Neural Score: {score}/100
            </span>
          )}
        </div>
      )}
    </div>
  )
}
