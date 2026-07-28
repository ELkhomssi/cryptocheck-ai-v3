'use client'

import type { ReactNode } from 'react'

export function Panel({
  title,
  live,
  action,
  children,
  className = '',
}: {
  title: string
  live?: boolean
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`tos-panel ${className}`.trim()}>
      <header className="tos-panel-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 className="tos-panel-title">{title}</h2>
          {live ? (
            <span className="tos-live">
              <span className="tos-live-dot" aria-hidden />
              LIVE
            </span>
          ) : null}
        </div>
        {action}
      </header>
      <div className="tos-panel-body">{children}</div>
    </section>
  )
}
