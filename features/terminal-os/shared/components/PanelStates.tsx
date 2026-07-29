'use client'

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      className="tos-skeleton-card"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: rows * 36 }}
      aria-hidden
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="tos-skeleton" style={{ height: 28, width: i === rows - 1 ? '70%' : '100%' }} />
      ))}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '18px 8px',
        textAlign: 'center',
        color: 'var(--tos-text-muted)',
        fontSize: 13,
      }}
    >
      {message}
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
