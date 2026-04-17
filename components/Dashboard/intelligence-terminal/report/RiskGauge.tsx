'use client'

/**
 * RiskGauge — Phase 4C
 *
 * Semi-circle radial gauge, 0–100. Pure SVG, no chart library.
 *
 * Geometry:
 *   viewBox 280×180, center (140,150), radius 120
 *   Arc path sweeps from (20,150) → (260,150), 180° counter-clockwise
 *   Path length ≈ π·r ≈ 377 for our half-circle
 *
 * Dash animation:
 *   We use stroke-dashoffset transition — more portable than mutating
 *   strokeDasharray and better for the motion-safe fallback (a snap
 *   to final position when reduced-motion is on).
 */

import type { Verdict } from '../design/tokens'

const ARC_LENGTH = 377 // approximation of π·120

export function RiskGauge({
  score,
  verdict,
}: {
  score: number
  verdict: Verdict
}) {
  const clamped = Math.max(0, Math.min(100, score))
  const pct = clamped / 100
  const dashOffset = ARC_LENGTH * (1 - pct)

  const color =
    verdict === 'SAFE' || verdict === 'CAUTION' ? '#00d4aa' : '#ff4757'
  const filterId = `gauge-glow-${verdict.toLowerCase()}`

  return (
    <svg
      viewBox="0 0 280 180"
      width="240"
      height="160"
      role="img"
      aria-label={`Risk score ${clamped} out of 100, verdict ${verdict}`}
      className="shrink-0"
    >
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background arc */}
      <path
        d="M 20 150 A 120 120 0 0 1 260 150"
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="16"
        strokeLinecap="round"
      />

      {/* Foreground arc — animates via dashoffset */}
      <path
        d="M 20 150 A 120 120 0 0 1 260 150"
        fill="none"
        stroke={color}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={ARC_LENGTH}
        strokeDashoffset={dashOffset}
        filter={`url(#${filterId})`}
        className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-[800ms] motion-safe:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
      />

      <text
        x="140"
        y="130"
        textAnchor="middle"
        className="fill-slate-600 font-mono text-[10px] uppercase tracking-[0.25em]"
      >
        RISK
      </text>
    </svg>
  )
}
