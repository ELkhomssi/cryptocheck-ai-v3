'use client'

/**
 * AnimatedNumber — Phase 4C
 *
 * Count-up on mount / value change, using rAF. Falls back to the
 * final value immediately when prefers-reduced-motion is set.
 *
 * Also exposes FlashOnChange — a wrapper that applies a motion-safe
 * color flash when its `value` prop changes (used by BasicMetricsGrid
 * ticker updates).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

type AnimatedNumberProps = {
  value: number
  duration?: number
  /** Decimals. Default 0. */
  decimals?: number
  /** Formatter applied to the tweening value. */
  format?: (n: number) => string
}

export function AnimatedNumber({
  value,
  duration = 800,
  decimals = 0,
  format,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(() =>
    prefersReducedMotion() ? value : 0
  )
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value)
      return
    }
    fromRef.current = display
    startRef.current = null

    const step = (t: number) => {
      if (startRef.current == null) startRef.current = t
      const elapsed = t - startRef.current
      const p = Math.min(1, elapsed / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      const next = fromRef.current + (value - fromRef.current) * eased
      setDisplay(next)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
    // We intentionally exclude `display` so we restart from its current
    // frame on value change rather than jumping back to 0.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  const rendered =
    format != null ? format(display) : display.toFixed(decimals)
  return <>{rendered}</>
}

/**
 * FlashOnChange — wraps any ReactNode and temporarily applies
 * `value-flash-up` / `value-flash-down` color animation whenever
 * `value` changes. Direction is inferred from previous value.
 */
export function FlashOnChange({
  value,
  children,
  className = '',
}: {
  value: number | null | undefined
  children: ReactNode
  className?: string
}) {
  const prevRef = useRef<number | null | undefined>(value)
  const [dir, setDir] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    if (
      prev != null &&
      value != null &&
      Number.isFinite(prev) &&
      Number.isFinite(value) &&
      prev !== value
    ) {
      setDir(value > prev ? 'up' : 'down')
      const t = window.setTimeout(() => setDir(null), 700)
      prevRef.current = value
      return () => window.clearTimeout(t)
    }
    prevRef.current = value
  }, [value])

  const flashClass =
    dir === 'up'
      ? 'motion-safe:animate-[value-flash-up_700ms_ease-out]'
      : dir === 'down'
        ? 'motion-safe:animate-[value-flash-down_700ms_ease-out]'
        : ''

  return <span className={`${className} ${flashClass}`}>{children}</span>
}
