'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ══════════════════════════════════════════════
//  AiAutoSniper — VIP AI Trading Bot
//  Premium gold/purple aesthetic
//  Simulates on-chain snipe execution flow
// ══════════════════════════════════════════════

interface SniperSettings {
  enabled:      boolean
  tradeSize:    string   // SOL
  takeProfit:   string   // %
  stopLoss:     string   // %
  minScore:     string   // Neural score 0-100
}

interface LogEntry {
  id:    number
  ts:    string
  type:  'info' | 'success' | 'warn' | 'error' | 'exec'
  text:  string
}

interface AiAutoSniperProps {
  currentMint:   string
  currentSymbol: string
  neuralScore:   number | null
  isActive:      boolean   // tab is visible
}

// ── Simulated snipe sequence ──────────────────
const SNIPE_SEQUENCE = (sym: string, score: number, settings: SniperSettings) => [
  { delay: 0,    type: 'info'    as const, text: `⟳  New signal detected — ${sym} (${currentMint_truncate()})` },
  { delay: 400,  type: 'info'    as const, text: `⟳  Fetching on-chain data from Helius RPC…` },
  { delay: 900,  type: 'info'    as const, text: `⟳  Running Neural Engine v2 analysis…` },
  { delay: 1400, type: score >= Number(settings.minScore) ? 'success' as const : 'warn' as const,
    text: score >= Number(settings.minScore)
      ? `✓  Risk Assessment: PASS — Score ${score}/100 ≥ Min ${settings.minScore}`
      : `⚠  Risk Assessment: SKIP — Score ${score}/100 < Min ${settings.minScore}` },
  ...(score >= Number(settings.minScore) ? [
    { delay: 1900, type: 'info'    as const, text: `⟳  Calculating optimal entry — ${settings.tradeSize} SOL…` },
    { delay: 2400, type: 'exec'    as const, text: `▶  Routing via Jupiter Aggregator…` },
    { delay: 2900, type: 'exec'    as const, text: `▶  Executing swap: ${settings.tradeSize} SOL → ${sym}` },
    { delay: 3500, type: 'success' as const, text: `✓  Snipe Successful! Entry confirmed on-chain` },
    { delay: 3800, type: 'info'    as const, text: `⟳  Setting TP: +${settings.takeProfit}% | SL: -${settings.stopLoss}%` },
    { delay: 4100, type: 'success' as const, text: `✓  Orders placed. Monitoring position…` },
  ] : [
    { delay: 1900, type: 'warn'    as const, text: `⚠  Signal skipped — score below threshold` },
    { delay: 2200, type: 'info'    as const, text: `⟳  Watching for next opportunity…` },
  ]),
]

function currentMint_truncate() {
  return '…' // placeholder — filled at runtime
}

export function AiAutoSniper({ currentMint, currentSymbol, neuralScore, isActive }: AiAutoSniperProps) {
  const [settings, setSettings] = useState<SniperSettings>({
    enabled:    false,
    tradeSize:  '0.5',
    takeProfit: '25',
    stopLoss:   '10',
    minScore:   '60',
  })

  const [logs,       setLogs]       = useState<LogEntry[]>([])
  const [running,    setRunning]     = useState(false)
  const [sniped,     setSniped]      = useState(0)
  const [skipped,    setSkipped]     = useState(0)
  const [totalPnl,   setTotalPnl]    = useState(0)
  const logIdRef  = useRef(0)
  const logEndRef = useRef<HTMLDivElement>(null)
  const prevMint  = useRef('')

  // Auto-scroll console
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = useCallback((type: LogEntry['type'], text: string) => {
    logIdRef.current++
    const entry: LogEntry = {
      id:   logIdRef.current,
      ts:   new Date().toLocaleTimeString('en', { hour12: false }),
      type,
      text,
    }
    setLogs(prev => [...prev.slice(-80), entry])
    return entry
  }, [])

  const runSnipeSequence = useCallback((mint: string, sym: string, score: number) => {
    if (running) return
    setRunning(true)

    const seq = SNIPE_SEQUENCE(sym, score, settings)

    seq.forEach(({ delay, type, text }) => {
      setTimeout(() => {
        const actualText = text.includes(currentMint_truncate())
          ? text.replace(currentMint_truncate(), `${mint.slice(0,8)}…`)
          : text
        addLog(type, actualText)
      }, delay)
    })

    const totalDelay = seq[seq.length - 1].delay + 500
    setTimeout(() => {
      setRunning(false)
      if (score >= Number(settings.minScore)) {
        setSniped(s => s + 1)
        // Simulate random PnL between -SL and +TP
        const mockPnl = Math.random() > 0.35
          ? +(Math.random() * Number(settings.takeProfit) * 0.01 * Number(settings.tradeSize)).toFixed(3)
          : -(Math.random() * Number(settings.stopLoss)   * 0.01 * Number(settings.tradeSize)).toFixed(3)
        setTotalPnl(prev => Math.round((prev + mockPnl) * 1000) / 1000)
      } else {
        setSkipped(s => s + 1)
      }
    }, totalDelay)
  }, [running, settings, addLog])

  // Trigger on new currentMint when sniper is ON and tab is active
  useEffect(() => {
    if (!isActive) return
    if (!settings.enabled) return
    if (!currentMint || currentMint.length < 32) return
    if (currentMint === prevMint.current) return
    prevMint.current = currentMint

    const score = neuralScore ?? Math.floor(Math.random() * 40 + 40)
    runSnipeSequence(currentMint, currentSymbol || 'TOKEN', score)
  }, [currentMint, isActive, settings.enabled, neuralScore, currentSymbol, runSnipeSequence])

  const set = (key: keyof SniperSettings, val: string | boolean) =>
    setSettings(prev => ({ ...prev, [key]: val }))

  const clearLogs = () => setLogs([])

  const logColor = (type: LogEntry['type']) => {
    switch(type) {
      case 'success': return '#10b981'
      case 'warn':    return '#f59e0b'
      case 'error':   return '#ef4444'
      case 'exec':    return '#a78bfa'
      default:        return '#6b7280'
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden',
      background:'#07070f', fontFamily:'"IBM Plex Mono", monospace' }}>

      {/* ── VIP Header ── */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(251,191,36,0.2)',
        background: 'linear-gradient(135deg,rgba(251,191,36,0.06),rgba(99,102,241,0.06))',
        flexShrink: 0,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{
              width:20, height:20, borderRadius:4,
              background:'linear-gradient(135deg,#f59e0b,#7c3aed)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'0.65rem', flexShrink:0,
            }}>⚡</div>
            <div>
              <div style={{ fontSize:'0.7rem', fontWeight:700, color:'#fbbf24', letterSpacing:'0.08em' }}>
                VIP AI AUTO-SNIPER
              </div>
              <div style={{ fontSize:'0.5rem', color:'#6b7280', marginTop:1 }}>
                Neural Engine v2 · Jupiter Execution
              </div>
            </div>
          </div>

          {/* Master ON/OFF toggle */}
          <button
            onClick={() => {
              const next = !settings.enabled
              set('enabled', next)
              addLog('info', next ? '⟳  Auto-Sniper ACTIVATED — monitoring feed…' : '■  Auto-Sniper DEACTIVATED')
            }}
            style={{
              padding: '5px 14px',
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.62rem',
              fontWeight: 700,
              fontFamily: '"IBM Plex Mono", monospace',
              letterSpacing: '0.06em',
              transition: 'all 0.2s',
              background: settings.enabled
                ? 'linear-gradient(135deg,#10b981,#059669)'
                : 'rgba(255,255,255,0.06)',
              color: settings.enabled ? '#fff' : '#6b7280',
              boxShadow: settings.enabled ? '0 0 12px rgba(16,185,129,0.4)' : 'none',
            }}
          >
            {settings.enabled ? '● ON' : '○ OFF'}
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
        borderBottom:'1px solid rgba(255,255,255,0.04)',
        flexShrink:0,
      }}>
        {[
          { label:'Sniped',   val: String(sniped),   color:'#10b981' },
          { label:'Skipped',  val: String(skipped),  color:'#f59e0b' },
          { label:'Sim. PnL', val: `${totalPnl >= 0 ? '+' : ''}${totalPnl} SOL`, color: totalPnl >= 0 ? '#10b981' : '#ef4444' },
        ].map(s => (
          <div key={s.label} style={{ padding:'7px 10px', textAlign:'center', borderRight:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize:'0.75rem', fontWeight:700, color:s.color, fontFamily:'"IBM Plex Mono"' }}>{s.val}</div>
            <div style={{ fontSize:'0.48rem', color:'#374151', marginTop:1, letterSpacing:'0.06em' }}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* ── Settings grid ── */}
      <div style={{ padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)', flexShrink:0 }}>
        <div style={{ fontSize:'0.5rem', color:'#6b7280', letterSpacing:'0.08em', marginBottom:7 }}>
          SNIPER SETTINGS
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          {[
            { key:'tradeSize',  label:'Trade Size (SOL)', placeholder:'0.5' },
            { key:'takeProfit', label:'Take Profit (%)',  placeholder:'25'  },
            { key:'stopLoss',   label:'Stop Loss (%)',    placeholder:'10'  },
            { key:'minScore',   label:'Min Neural Score', placeholder:'60'  },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize:'0.48rem', color:'#6b7280', marginBottom:3, letterSpacing:'0.06em' }}>
                {f.label.toUpperCase()}
              </div>
              <input
                type="number"
                value={settings[f.key as keyof SniperSettings] as string}
                onChange={e => set(f.key as keyof SniperSettings, e.target.value)}
                placeholder={f.placeholder}
                style={{
                  width:'100%', boxSizing:'border-box',
                  background:'rgba(255,255,255,0.04)',
                  border:'1px solid rgba(251,191,36,0.15)',
                  borderRadius:3, padding:'5px 8px',
                  fontSize:'0.65rem', fontFamily:'"IBM Plex Mono"',
                  color:'#e6edf3', outline:'none',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Live Console ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden' }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'5px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)', flexShrink:0,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ fontSize:'0.5rem', color:'#6b7280', letterSpacing:'0.08em' }}>LIVE CONSOLE</div>
            {running && (
              <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width:4, height:4, borderRadius:'50%', background:'#a78bfa',
                    animation:`bounce 0.7s ease-in-out ${i*0.15}s infinite`,
                  }} />
                ))}
              </div>
            )}
          </div>
          <button onClick={clearLogs} style={{
            background:'transparent', border:'none', cursor:'pointer',
            fontSize:'0.48rem', color:'#374151', fontFamily:'"IBM Plex Mono"',
          }}>CLR</button>
        </div>

        <div style={{
          flex:1, overflowY:'auto', padding:'8px 12px',
          background:'#030308', minHeight:0,
          fontFamily:'"IBM Plex Mono", monospace',
        }}>
          {logs.length === 0 && (
            <div style={{ color:'#374151', fontSize:'0.58rem', paddingTop:8 }}>
              {settings.enabled
                ? '⟳  Waiting for signal from Alpha Feed…'
                : '○  Auto-Sniper is OFF. Toggle to activate.'}
            </div>
          )}
          {logs.map(log => (
            <div key={log.id} style={{ display:'flex', gap:8, marginBottom:3, lineHeight:1.5 }}>
              <span style={{ color:'#374151', fontSize:'0.5rem', flexShrink:0, paddingTop:1 }}>
                {log.ts}
              </span>
              <span style={{ color:logColor(log.type), fontSize:'0.58rem' }}>
                {log.text}
              </span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <div style={{
        padding:'5px 12px', borderTop:'1px solid rgba(255,255,255,0.04)',
        fontSize:'0.46rem', color:'#374151', flexShrink:0, lineHeight:1.4,
      }}>
        ⚠ Simulated demo. Not financial advice. All trades are illustrative.
      </div>
    </div>
  )
}
