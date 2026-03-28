'use client'
import { useState, useEffect } from 'react'
import { checkTrialStatus, TrialStatus } from '@/lib/trial'

// ── Trial Countdown Banner ──
export function TrialBanner({ walletAddress }: { walletAddress?: string | null }) {
  const [trial, setTrial] = useState<TrialStatus | null>(null)

  useEffect(() => {
    checkTrialStatus(walletAddress).then(setTrial)
    const iv = setInterval(() => checkTrialStatus(walletAddress).then(setTrial), 60000)
    return () => clearInterval(iv)
  }, [walletAddress])

  if (!trial || trial.isPro) return null

  const urgent = trial.daysRemaining < 1
  const color  = urgent ? '#ef4444' : trial.daysRemaining < 2 ? '#f59e0b' : '#38bdf8'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '3px 10px',
      background: `${color}10`,
      border: `1px solid ${color}30`,
      borderRadius: '4px',
      fontSize: '9px',
      fontFamily: 'IBM Plex Mono, monospace',
      color: color,
    }}>
      {urgent ? '🔴' : '⏱️'}
      <span style={{ fontWeight: 700 }}>
        {trial.expired ? 'TRIAL EXPIRED' : `Free Trial: ${trial.displayTime} left`}
      </span>
      {!trial.expired && (
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>· Upgrade to keep access</span>
      )}
    </div>
  )
}

// ── Trial Hard Wall (full overlay) ──
export function TrialWall({
  onUpgrade,
  daysUsed = 4,
}: {
  onUpgrade: () => void
  daysUsed?: number
}) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(3,3,12,0.96)',
      backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'IBM Plex Mono, monospace',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        background: 'linear-gradient(135deg, rgba(10,10,28,0.98) 0%, rgba(14,14,32,0.98) 100%)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '480px',
        width: '90%',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #6366f1, #a78bfa, transparent)' }} />

        {/* Icon */}
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>

        {/* Title */}
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#e6edf3', marginBottom: '8px' }}>
          Your Free Trial Has Ended
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '24px', lineHeight: 1.6 }}>
          You've used {daysUsed} days of your free trial.<br/>
          Upgrade to PRO to keep your trading edge.
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '24px' }}>
          {[
            { label: 'Rugs Avoided', value: '12', icon: '🛡️' },
            { label: 'Value Protected', value: '$4.5K', icon: '💰' },
            { label: 'Signals Missed', value: '0', icon: '📡' },
          ].map(item => (
            <div key={item.label} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '8px', padding: '12px 8px',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{item.icon}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#e6edf3' }}>{item.value}</div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div style={{
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: '10px', padding: '16px',
          marginBottom: '20px',
        }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>CRYPTOCHECK AI PRO</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', marginBottom: '12px' }}>
            <span style={{ fontSize: '32px', fontWeight: 700, color: '#a78bfa' }}>$30</span>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>/month</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              '✅ Unlimited Neural Scans',
              '✅ Rug Forensics Lab',
              '✅ Whale Insider Intelligence',
              '✅ AI Auto-Sniper (VIP)',
              '✅ Real-time Alpha Feed',
            ].map(feature => (
              <div key={feature} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textAlign: 'left' }}>{feature}</div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onUpgrade}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            border: 'none', borderRadius: '10px',
            padding: '14px', color: '#fff',
            fontSize: '13px', fontWeight: 700,
            letterSpacing: '0.05em', cursor: 'pointer',
            fontFamily: 'IBM Plex Mono, monospace',
            boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            marginBottom: '12px',
          }}
        >
          ⚡ Upgrade to PRO — $30/mo
        </button>

        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>
          Pay with SOL, USDC, or card · Instant access · Cancel anytime
        </div>
      </div>
    </div>
  )
}

// ── useTrialStatus hook ──
export function useTrialStatus(walletAddress?: string | null) {
  const [trial, setTrial] = useState<TrialStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkTrialStatus(walletAddress).then(t => {
      setTrial(t)
      setLoading(false)
    })
    const iv = setInterval(() => checkTrialStatus(walletAddress).then(setTrial), 60000)
    return () => clearInterval(iv)
  }, [walletAddress])

  return { trial, loading }
}
