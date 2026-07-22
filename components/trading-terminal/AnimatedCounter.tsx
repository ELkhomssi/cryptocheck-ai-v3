'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  value: number | null
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
  durationMs?: number
}

/** Smooth institutional counter — tweens toward target without flashy casino feel. */
export function AnimatedCounter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  durationMs = 700,
}: Props) {
  const [display, setDisplay] = useState(value ?? 0)
  const fromRef = useRef(value ?? 0)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (value == null) return
    const from = fromRef.current
    const to = value
    const start = performance.now()
    if (frameRef.current) cancelAnimationFrame(frameRef.current)

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const cur = from + (to - from) * eased
      setDisplay(cur)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [value, durationMs])

  if (value == null) {
    return <span className={className}>—</span>
  }

  const formatted =
    decimals > 0
      ? display.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(display).toLocaleString()

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
