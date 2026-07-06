'use client'

import { useEffect, useId, useState } from 'react'

export type ScoreRingProps = {
  value: number
  size?: number
  stroke?: number
  className?: string
  label?: string
}

export function ScoreRing({ value, size = 44, stroke = 3, className = '', label }: ScoreRingProps) {
  const uid = useId().replace(/:/g, '')
  const [offset, setOffset] = useState(1)
  const clamped = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const target = 1 - clamped / 100
  const fontSize = size >= 100 ? 'text-[34px]' : size >= 44 ? 'text-[15px]' : 'text-[13px]'

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setOffset(target)
      return
    }
    const t = requestAnimationFrame(() => setOffset(target))
    return () => cancelAnimationFrame(t)
  }, [target])

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className="relative inline-flex shrink-0 items-center justify-center"
        role="img"
        aria-label={label ?? `AI score ${Math.round(clamped)} of 100`}
      >
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={`ring-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--dash-ring-from)" />
              <stop offset="100%" stopColor="var(--dash-ring-to)" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className="stroke-dash-innerline"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#ring-${uid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * offset}
            className="shadow-dash-ring"
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.16,1,0.3,1)' }}
          />
        </svg>
        <span className={`font-dash-mono absolute font-medium tabular-nums text-dash-green ${fontSize}`}>
          {Math.round(clamped)}
        </span>
      </div>
      {label ? <span className="mt-0.5 text-[10px] text-dash-tlo">{label}</span> : null}
    </div>
  )
}
