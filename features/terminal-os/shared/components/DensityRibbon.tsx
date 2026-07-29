'use client'

import {
  useCallback,
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

/**
 * Presentation-only infinite ribbon.
 * Duplicate strip + CSS translateX; pause on hover or keyboard focus within.
 * Does not fetch or transform business data.
 */
export function DensityRibbon<T>({
  items,
  renderItem,
  itemKey,
  className = '',
  itemClassName = '',
  ariaLabel,
  onItemActivate,
  speedPxPerSec = 36,
}: {
  items: readonly T[]
  renderItem: (item: T, index: number) => ReactNode
  itemKey: (item: T, index: number) => string
  className?: string
  itemClassName?: string
  ariaLabel: string
  /** Optional — only wire when an existing profile/handler already exists */
  onItemActivate?: (item: T, index: number) => void
  speedPxPerSec?: number
}) {
  const [paused, setPaused] = useState(false)
  const [focusInside, setFocusInside] = useState(false)

  const strip = useMemo(() => {
    if (!items.length) return [] as T[]
    // Ensure enough width for a seamless loop on wide viewports
    return items.length < 8 ? [...items, ...items, ...items] : [...items]
  }, [items])

  // Duration ≈ distance/speed; approximate strip width via item count × ~220px
  const durationSec = Math.max(18, Math.round((strip.length * 220) / speedPxPerSec))

  const onFocusCapture = useCallback((e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.target as Node)) setFocusInside(true)
  }, [])
  const onBlurCapture = useCallback((e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusInside(false)
  }, [])

  const isPaused = paused || focusInside

  if (!items.length) return null

  return (
    <div
      className={`tos-density-ribbon ${className}`.trim()}
      aria-label={ariaLabel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <div
        className={`tos-density-track${isPaused ? ' is-paused' : ''}`}
        style={{ ['--tos-ribbon-dur' as string]: `${durationSec}s` }}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="tos-density-strip" aria-hidden={copy === 1}>
            {strip.map((item, idx) => {
              const key = `${copy}-${itemKey(item, idx)}`
              const interactive = Boolean(onItemActivate)
              const content = renderItem(item, idx % items.length)
              if (!interactive) {
                return (
                  <div
                    key={key}
                    className={`tos-density-item ${itemClassName}`.trim()}
                    tabIndex={copy === 0 ? 0 : -1}
                  >
                    {content}
                  </div>
                )
              }
              return (
                <button
                  key={key}
                  type="button"
                  className={`tos-density-item tos-density-item-btn ${itemClassName}`.trim()}
                  tabIndex={copy === 0 ? 0 : -1}
                  onClick={() => onItemActivate?.(item, idx % items.length)}
                  onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onItemActivate?.(item, idx % items.length)
                    }
                  }}
                >
                  {content}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
