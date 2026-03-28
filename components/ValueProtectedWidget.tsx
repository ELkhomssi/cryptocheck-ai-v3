'use client'
import { useState, useEffect, useRef } from 'react'

interface ProtectedEvent {
  token: string
  symbol: string
  score: number
  estimatedLoss: number
  timestamp: number
  rugType: 'MINT_AUTHORITY' | 'LOW_LIQUIDITY' | 'HIGH_CONCENTRATION' | 'PRICE_CRASH'
}

function CountUp({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    if (target === 0) return
    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.floor(target * eased))
      if (progress >= 1) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return <>{current.toLocaleString()}</>
}

const RUG_TYPES: Record<string, { label: string; color: string; icon: string }> = {
  MINT_AUTHORITY:    { label: 'Mint Risk',     color: '#ef4444', icon: '⚠️' },
  LOW_LIQUIDITY:     { label: 'Rug Liquidity', color: '#f59e0b', icon: '🚨' },
  HIGH_CONCENTRATION:{ label: 'Whale Dump',    color: '#a78bfa', icon: '🐋' },
  PRICE_CRASH:       { label: 'Price Crash',   color: '#ef4444', icon: '📉' },
}

export default function ValueProtectedWidget({ events }: { events?: ProtectedEvent[] }) {
  const demoEvents: ProtectedEvent[] = events || [
    { token: 'SLERF2pump...', symbol: 'SLERF2', score: 12, estimatedLoss: 2400, timestamp: Date.now() - 120000, rugType: 'MINT_AUTHORITY' },
    { token: 'MEWfake...', symbol: 'MEWF', score: 8, estimatedLoss: 850, timestamp: Date.now() - 480000, rugType: 'LOW_LIQUIDITY' },
    { token: 'BONKscam...', symbol: 'BONKS', score: 21, estimatedLoss: 1200, timestamp: Date.now() - 900000, rugType: 'HIGH_CONCENTRATION' },
  ]

  const totalProtected = demoEvents.reduce((a, e) => a + e.estimatedLoss, 0)
  const rugCount = demoEvents.length
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const iv = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(8,8,24,0.95) 0%, rgba(12,12,28,0.95) 100%)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(34,197,94,0.2)',
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative',
      marginBottom: '12px',
    }}>
      {/* Glow effect */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '12px',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.08) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Top accent */}
      <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #22c55e, #10b981, transparent)' }} />

      <div style={{ padding: '16px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#22c55e',
              boxShadow: pulse ? '0 0 12px #22c55e' : '0 0 4px #22c55e',
              transition: 'box-shadow 0.5s ease',
            }} />
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#22c55e', fontFamily: 'IBM Plex Mono, monospace' }}>
              NEURAL PROTECTION ACTIVE
            </span>
          </div>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono, monospace' }}>
            Pays for itself
          </span>
        </div>

        {/* Main counter */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: '4px', fontFamily: 'IBM Plex Mono, monospace' }}>
              TOTAL VALUE PROTECTED
            </div>
            <div style={{
              fontSize: '36px', fontWeight: 700, color: '#22c55e',
              fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1,
              textShadow: '0 0 20px rgba(34,197,94,0.4)',
            }}>
              $<CountUp target={totalProtected} />
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', fontFamily: 'IBM Plex Mono, monospace' }}>
              across {rugCount} rugs avoided this session
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: 'auto' }}>
            {[
              { label: 'Rugs Blocked', value: rugCount.toString(), color: '#ef4444' },
              { label: 'Avg Save',     value: `$${Math.floor(totalProtected/rugCount).toLocaleString()}`, color: '#f59e0b' },
              { label: 'ROI vs $30',   value: `${Math.floor(totalProtected/30)}x`,  color: '#22c55e' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', width: '70px', fontFamily: 'IBM Plex Mono, monospace' }}>{item.label}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: item.color, fontFamily: 'IBM Plex Mono, monospace' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Events log */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: '8px', fontFamily: 'IBM Plex Mono, monospace' }}>
            RECENT PROTECTION EVENTS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {demoEvents.map((event, i) => {
              const type = RUG_TYPES[event.rugType]
              const age = Math.floor((Date.now() - event.timestamp) / 60000)
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderLeft: `2px solid ${type.color}`,
                  borderRadius: '4px',
                  fontSize: '10px',
                }}>
                  <span>{type.icon}</span>
                  <span style={{ color: '#e6edf3', fontWeight: 600, fontFamily: 'IBM Plex Mono, monospace' }}>${event.symbol}</span>
                  <span style={{ color: type.color, fontSize: '9px', background: `${type.color}15`, padding: '1px 5px', borderRadius: '3px', fontFamily: 'IBM Plex Mono, monospace' }}>{type.label}</span>
                  <span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 'auto', fontFamily: 'IBM Plex Mono, monospace' }}>+${event.estimatedLoss.toLocaleString()} saved</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'IBM Plex Mono, monospace' }}>{age}m ago</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
