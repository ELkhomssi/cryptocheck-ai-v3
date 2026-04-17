'use client'

/**
 * Card — Phase 4C
 *
 * The shared visual primitive. Every report card sits inside one.
 * Achieves a "gradient border" feel using a single `::before`
 * pseudo-element — no nested wrappers, no SVG, no paint tax.
 *
 * Accents tint that top gradient based on verdict / semantic state.
 *
 * NOTE (Tailwind JIT): class strings must be written as complete
 * literals so the compiler can see them. We do NOT interpolate
 * accent key into the class name.
 */

import type { HTMLAttributes, ReactNode } from 'react'

export type CardAccent = 'neutral' | 'safe' | 'danger' | 'warning'

const ACCENT_CLASSES: Record<CardAccent, string> = {
  neutral:
    'before:bg-gradient-to-r before:from-white/5 before:via-white/15 before:to-white/5',
  safe: 'before:bg-gradient-to-r before:from-[#00d4aa]/10 before:via-[#00d4aa]/40 before:to-[#00d4aa]/10',
  danger:
    'before:bg-gradient-to-r before:from-[#ff4757]/10 before:via-[#ff4757]/40 before:to-[#ff4757]/10',
  warning:
    'before:bg-gradient-to-r before:from-[#ffa502]/10 before:via-[#ffa502]/40 before:to-[#ffa502]/10',
}

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  accent?: CardAccent
  children: ReactNode
}

export function Card({
  children,
  accent = 'neutral',
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-xl
        border border-white/5 bg-[#0b1220]/60 backdrop-blur-xl
        before:absolute before:inset-x-0 before:top-0 before:h-px before:content-['']
        ${ACCENT_CLASSES[accent]}
        motion-safe:transition-shadow motion-safe:duration-200
        hover:shadow-[0_4px_32px_rgba(0,212,170,0.08)]
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}
