'use client'

import { useEffect, useState } from 'react'
import '@/lib/dashboard/tokens.css'
import '@/lib/revenue-dashboard/design-tokens.css'
import { ScoreRing } from '@/components/dash-home/primitives/ScoreRing'
import { FactorRow } from '@/components/dash-home/FactorRow'
import { scanResultToFactors, verdictLabel } from '@/lib/command-center/scan-factors'
import type { ScanResult } from '@/lib/revenue-dashboard/types'

const SAMPLE_SCANS: ScanResult[] = [
  {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'WSOL',
    name: 'Wrapped SOL',
    safetyScore: 82,
    riskScore: 18,
    verdict: 'SAFE',
    confidence: 'high',
    topSignals: [],
    evidenceLine: 'Sample · mint authority revoked · healthy liquidity',
    scannedAt: new Date().toISOString(),
    cache: 'miss',
    sample: true,
  },
  {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'DEMO',
    name: 'Caution sample',
    safetyScore: 54,
    riskScore: 46,
    verdict: 'CAUTION',
    confidence: 'medium',
    topSignals: [],
    evidenceLine: 'Sample · elevated concentration · thin order book',
    scannedAt: new Date().toISOString(),
    cache: 'miss',
    sample: true,
  },
  {
    mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    symbol: 'RUG?',
    name: 'Danger sample',
    safetyScore: 22,
    riskScore: 78,
    verdict: 'DANGER',
    confidence: 'high',
    topSignals: [],
    evidenceLine: 'Sample · mint live · clustered holders · swap gated',
    scannedAt: new Date().toISOString(),
    cache: 'miss',
    sample: true,
  },
]

function toneFromWord(word: string): 'good' | 'mid' | 'bad' {
  if (['Low', 'Safe', 'Strong', 'Good', 'Pass', 'OK'].includes(word)) return 'good'
  if (word === 'Moderate' || word === 'Warn') return 'mid'
  return 'bad'
}

function riskWord(v: ScanResult['verdict']): string {
  if (v === 'SAFE') return 'Low Risk'
  if (v === 'CAUTION') return 'Moderate Risk'
  return 'High Risk'
}

function verdictChipStyle(v: ScanResult['verdict']): { bg: string; border: string; color: string } {
  if (v === 'SAFE') return { bg: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', color: '#22C55E' }
  if (v === 'CAUTION') return { bg: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.4)', color: '#F97316' }
  return { bg: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444' }
}

function truncateMint(mint: string): string {
  if (mint.length <= 12) return mint
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`
}

type Props = {
  /** Real scan from scan_history when presentable; otherwise null → sample cycle only. */
  realScan: ScanResult | null
}

/**
 * Hero visual = live scan-verdict UI (same ScoreRing + factors as Action Panel),
 * not a mascot. Cycles SAFE / CAUTION / DANGER so the product demonstrates itself.
 */
export function LandingHeroScanPanel({ realScan }: Props) {
  const cycle: ScanResult[] = realScan
    ? [realScan, ...SAMPLE_SCANS.filter((s) => s.verdict !== realScan.verdict)]
    : SAMPLE_SCANS

  const [idx, setIdx] = useState(0)
  const scan = cycle[idx] ?? SAMPLE_SCANS[0]!
  const factors = scanResultToFactors(scan)
  const chip = verdictChipStyle(scan.verdict)

  useEffect(() => {
    if (cycle.length < 2) return
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % cycle.length)
    }, 4200)
    return () => window.clearInterval(id)
  }, [cycle.length])

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 14,
        border: '1px solid rgba(32,178,170,0.28)',
        background: 'linear-gradient(165deg, rgba(18,18,18,0.98) 0%, rgba(10,10,10,0.98) 100%)',
        padding: 'clamp(18px,3vw,28px)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 40px rgba(32,178,170,0.08)',
        overflow: 'hidden',
      }}
      aria-live="polite"
      aria-label="Neural scan verdict preview"
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(32,178,170,0.12), transparent)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', color: '#64748b', fontWeight: 700 }}>
            AI TOKEN SCANNER · NEURAL V4
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>Same verdict UI as the live dashboard</div>
        </div>
        {scan.sample ? (
          <span className="rd-sample-tag" style={{ borderColor: 'rgba(148,163,184,0.45)', color: '#94a3b8' }}>
            sample
          </span>
        ) : (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#20b2aa',
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid rgba(32,178,170,0.35)',
              background: 'rgba(32,178,170,0.1)',
            }}
          >
            live scan
          </span>
        )}
      </div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }} className="sm:flex-row sm:items-start">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <ScoreRing value={scan.safetyScore} size={110} stroke={6} label="Neural score" />
          <p className="font-dash-mono" style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>
            /100
          </p>
          <p className="font-dash-mono" style={{ fontSize: 11, textTransform: 'uppercase', color: '#94a3b8' }}>
            {riskWord(scan.verdict)}
          </p>
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#64748b' }}>
              AI Verdict
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.12em',
                padding: '4px 10px',
                borderRadius: 6,
                background: chip.bg,
                border: chip.border,
                color: chip.color,
              }}
            >
              {scan.verdict}
            </span>
            {scan.sample ? <span className="rd-sample-tag">sample</span> : null}
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{verdictLabel(scan.verdict)}</p>
          <p className="font-dash-mono" style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
            {scan.symbol} · {truncateMint(scan.mint)}
          </p>
          <p style={{ fontSize: 12, color: '#8b949e', marginTop: 8, lineHeight: 1.5 }}>{scan.evidenceLine}</p>

          <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
            {factors.map((f) => (
              <FactorRow
                key={f.label}
                name={f.label}
                meterLevel={f.filled}
                word={f.status}
                tone={toneFromWord(f.status)}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          marginTop: 16,
          display: 'flex',
          gap: 6,
          justifyContent: 'center',
        }}
        aria-hidden
      >
        {cycle.map((s, i) => (
          <button
            key={`${s.verdict}-${i}`}
            type="button"
            onClick={() => setIdx(i)}
            style={{
              width: i === idx ? 18 : 8,
              height: 8,
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              background: i === idx ? '#20b2aa' : 'rgba(255,255,255,0.15)',
              transition: 'width 0.2s, background 0.2s',
              padding: 0,
            }}
            aria-label={`Show ${s.verdict} verdict`}
          />
        ))}
      </div>
    </div>
  )
}
