'use client'

import { useEffect, useState } from 'react'

export type PulseRow = {
  mint: string
  aggregateScore: number
  verdict: string
  institutionalGrade: string
  ts: string
}

export function PulseFeed() {
  const [rows, setRows] = useState<PulseRow[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/v1/pulse', { cache: 'no-store' })
        const j = await r.json()
        if (!cancelled && Array.isArray(j.feed)) setRows(j.feed)
      } catch {
        if (!cancelled) setErr('Pulse unavailable')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 540px) {
          .cc-pulse-row {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 6px !important;
          }
        }
      `}} />
    <section
      style={{
        marginTop: 28,
        borderRadius: 14,
        border: '0.5px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(160deg, rgba(99,102,241,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        backdropFilter: 'blur(16px)',
        padding: 'clamp(16px,3vw,22px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#818cf8' }}>INSTANT PULSE</div>
          <div style={{ fontSize: 13, color: '#e5e7eb', marginTop: 4 }}>Latest institutional-grade scans (global)</div>
        </div>
        <div className="cc-pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
      </div>
      {err && <div style={{ marginTop: 10, fontSize: 12, color: '#f87171' }}>{err}</div>}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map((row, i) => (
          <div
            key={`${row.mint}-${row.ts}-${i}`}
            className="cc-pulse-row"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) auto auto auto',
              gap: 10,
              alignItems: 'center',
              padding: '10px 0',
              borderTop: i === 0 ? 'none' : '0.5px solid rgba(255,255,255,0.06)',
              fontSize: 12,
            }}
          >
            <span style={{ color: '#cbd5e1', fontFamily: 'var(--font-geist-mono), monospace', wordBreak: 'break-all' }}>{row.mint}</span>
            <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{row.institutionalGrade}</span>
            <span style={{ color: '#34d399', whiteSpace: 'nowrap' }}>{row.aggregateScore}</span>
            <span style={{ color: '#a5b4fc', whiteSpace: 'nowrap', fontSize: 11 }}>{row.verdict}</span>
          </div>
        ))}
        {!rows.length && !err && (
          <div style={{ fontSize: 12, color: '#64748b', padding: '8px 0' }}>Loading pulse…</div>
        )}
      </div>
    </section>
    </>
  )
}
