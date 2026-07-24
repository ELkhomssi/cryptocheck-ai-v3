'use client'

import type { ReactNode } from 'react'

type PageHeaderProps = {
  /** Mono kicker above the title, e.g. "// PORTFOLIO" */
  kicker: string
  title: string
  subtitle: string
  /** Optional right-side slot (e.g. range tabs) */
  actions?: ReactNode
}

/**
 * Shared terminal page header — kicker + title + subtitle.
 * Colors come from CSS variables so dark/light themes stay in sync.
 */
export function PageHeader({ kicker, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="pd-page-head">
      <div>
        <div className="pd-page-kicker pd-num">{kicker}</div>
        <h1 className="pd-page-title">{title}</h1>
        <p className="pd-page-subtitle">{subtitle}</p>
      </div>
      {actions ?? null}
    </div>
  )
}
