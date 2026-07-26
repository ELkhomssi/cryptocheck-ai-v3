'use client'

/** Reuses the AI Coach Online status-dot treatment. */
export function StatusDot({
  online,
  label,
}: {
  online: boolean | null
  label?: string
}) {
  const statusColor = online === false ? 'var(--pd-text-faint)' : 'var(--pd-positive)'
  const statusLabel =
    label ?? (online === false ? 'Offline' : online === null ? '…' : 'Online')
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: statusColor }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: statusColor,
          boxShadow: online ? '0 0 0 3px var(--pd-positive-soft)' : undefined,
        }}
      />
      {statusLabel}
    </span>
  )
}
