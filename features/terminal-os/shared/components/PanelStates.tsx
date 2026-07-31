'use client'

import { Inbox } from 'lucide-react'

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      className="tos-skeleton-card"
      style={{ minHeight: `calc(${rows} * 2.25rem)` }}
      aria-hidden
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="tos-skeleton"
          style={{ height: '1.75rem', width: i === rows - 1 ? '70%' : '100%' }}
        />
      ))}
    </div>
  )
}

export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="tos-empty">
      <Inbox className="tos-empty-icon" size={18} aria-hidden />
      <p className="tos-empty-copy">{message}</p>
      {actionLabel && onAction ? (
        <button type="button" className="tos-btn tos-btn-ghost" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function ComingOnline({ label }: { label: string }) {
  return <EmptyState message={`${label} — Coming online…`} />
}

/** Demo-day rule: subtle staleness — never red error banners */
export function StaleIndicator({
  stale,
  demo,
  ageSec,
  source,
}: {
  stale?: boolean
  demo?: boolean
  ageSec?: number
  source?: string
}) {
  if (!stale && !demo) return null
  const label = demo
    ? 'Demo fallback · labeled'
    : ageSec != null && ageSec > 0
      ? `Last updated ${ageSec}s ago`
      : 'Cached'
  return (
    <div className="tos-stale" title={source ? `Source: ${source}` : undefined} role="status">
      <span className="tos-stale-dot" aria-hidden />
      {label}
    </div>
  )
}
