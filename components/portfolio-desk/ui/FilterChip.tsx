'use client'

/**
 * Filter / preference chip — Phase 13.2 three-tier hierarchy.
 * Never uses solid accent fill (reserved for primary CTAs like .pd-connect).
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type FilterChipProps = {
  selected?: boolean
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

export function FilterChip({
  selected = false,
  children,
  className,
  type = 'button',
  ...rest
}: FilterChipProps) {
  return (
    <button
      type={type}
      className={`pd-chip${selected ? ' is-selected' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={selected}
      {...rest}
    >
      {children}
    </button>
  )
}
