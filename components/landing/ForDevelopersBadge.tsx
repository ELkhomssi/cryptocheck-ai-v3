'use client'

import type { CSSProperties } from 'react'

type Props = {
  /** Compact for inline headers; default matches landing + pro chrome */
  size?: 'sm' | 'md'
  className?: string
  style?: CSSProperties
}

/**
 * Sleek technical tag — used next to “Dashboard Pro” on the product header
 * and landing Interactive Demo.
 */
export function ForDevelopersBadge({ size = 'sm', className, style }: Props) {
  const sm = size === 'sm'
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: sm ? '2px 8px' : '3px 10px',
        borderRadius: 4,
        fontSize: sm ? 9 : 10,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#7dd3fc',
        background: 'rgba(56,189,248,0.1)',
        border: '1px solid rgba(56,189,248,0.28)',
        fontFamily: "var(--font-geist-mono), 'IBM Plex Mono', ui-monospace, monospace",
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          width: sm ? 5 : 6,
          height: sm ? 5 : 6,
          borderRadius: '50%',
          background: '#38bdf8',
          boxShadow: '0 0 8px rgba(56,189,248,0.55)',
        }}
      />
      For Developers
    </span>
  )
}
