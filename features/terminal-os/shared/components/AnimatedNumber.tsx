'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Animated number — max ~10 paints/sec, count toward target without hard snap.
 * Holds the 200ms perceived-speed budget on stream updates.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number
  format: (n: number) => string
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const targetRef = useRef(value)
  const displayRef = useRef(value)
  const rafRef = useRef<number | null>(null)
  const lastPaintRef = useRef(0)

  useEffect(() => {
    targetRef.current = value
    const step = (ts: number) => {
      const minInterval = 100 // ≤10/sec
      if (ts - lastPaintRef.current < minInterval) {
        rafRef.current = requestAnimationFrame(step)
        return
      }
      lastPaintRef.current = ts
      const cur = displayRef.current
      const tgt = targetRef.current
      const delta = tgt - cur
      if (Math.abs(delta) < Math.max(Math.abs(tgt) * 0.0005, 0.000001)) {
        displayRef.current = tgt
        setDisplay(tgt)
        rafRef.current = null
        return
      }
      // Ease ~60% of gap per paint → settles in a few frames (<200ms feel)
      const next = cur + delta * 0.42
      displayRef.current = next
      setDisplay(next)
      rafRef.current = requestAnimationFrame(step)
    }
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [value])

  return <span className={className}>{format(display)}</span>
}
