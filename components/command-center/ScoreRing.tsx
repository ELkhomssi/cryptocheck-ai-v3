'use client'

import { useEffect, useId, useState } from 'react'

type Props = {
  score: number
  max?: number
  size?: number
  stroke?: number
  label?: string
  className?: string
}

export function ScoreRing({
  score,
  max = 100,
  size = 52,
  stroke = 4,
  label,
  className = '',
}: Props) {
  const uid = useId().replace(/:/g, '')
  const [animated, setAnimated] = useState(0)
  const clamped = Math.max(0, Math.min(max, score))
  const pct = max > 0 ? clamped / max : 0
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - animated)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setAnimated(pct)
      return
    }
    const t = requestAnimationFrame(() => setAnimated(pct))
    return () => cancelAnimationFrame(t)
  }, [pct])

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      role="img"
      aria-label={label ?? `AI score ${Math.round(clamped)} out of ${max}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`cc-ring-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7be84b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0.7" />
          </linearGradient>
          <filter id={`cc-glow-${uid}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(123,232,75,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#cc-ring-${uid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          filter={`url(#cc-glow-${uid})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      <span
        className="cc-mono absolute text-center text-[0.7rem] font-semibold text-[var(--cc-green)]"
        style={{ fontSize: size < 44 ? '0.62rem' : '0.72rem' }}
      >
        {Math.round(clamped)}
      </span>
    </div>
  )
}
