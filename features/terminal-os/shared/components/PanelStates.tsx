'use client'

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="tos-skeleton" style={{ height: 28, width: '100%' }} />
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
