'use client'

import type { ScoreBand } from '../types'

const BAND_COLOR: Record<ScoreBand, string> = {
  excellent: 'var(--tos-score-excellent)',
  good: 'var(--tos-score-good)',
  caution: 'var(--tos-score-caution)',
  danger: 'var(--tos-score-danger)',
}

export function scoreToBand(score: number): ScoreBand {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'caution'
  return 'danger'
}

/** SVG stroke-dasharray score ring — color-coded by band */
export function ScoreRing({
  score,
  band,
  size = 112,
  label,
  sublabel,
}: {
  score: number
  band: ScoreBand
  size?: number
  label?: string
  sublabel?: string
}) {
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, score))
  const offset = c - (clamped / 100) * c
  const color = BAND_COLOR[band]

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        margin: '0 auto',
      }}
      role="img"
      aria-label={`Score ${score} out of 100, ${band}`}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--tos-border-subtle)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 400ms ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 8,
        }}
      >
        <div className="tos-num" style={{ fontSize: size * 0.22, fontWeight: 800, lineHeight: 1 }}>
          {Math.round(score)}
          <span style={{ fontSize: size * 0.1, color: 'var(--tos-text-muted)' }}>/100</span>
        </div>
        {label ? (
          <div
            style={{
              marginTop: 4,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </div>
        ) : null}
        {sublabel ? (
          <div style={{ fontSize: 10, color: 'var(--tos-text-secondary)', marginTop: 2 }}>
            {sublabel}
          </div>
        ) : null}
      </div>
    </div>
  )
}
