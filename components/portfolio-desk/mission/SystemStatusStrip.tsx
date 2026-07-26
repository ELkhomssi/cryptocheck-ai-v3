'use client'

/**
 * Phase 16.9 — System Status strip: 6 module badges + Overall System Health.
 */

import type { IntelligenceModuleState, ModuleCardView } from '@/types/intelligence'

const STATE_LABEL: Record<IntelligenceModuleState, string> = {
  running: 'Running',
  investigating: 'Investigating',
  waiting: 'Waiting',
  idle: 'Idle',
}

export function SystemStatusStrip({
  modules,
  overallHealth,
  loading,
}: {
  modules: ModuleCardView[]
  overallHealth: { score: number | null; calibrating: boolean }
  loading?: boolean
}) {
  if (loading) {
    return <div className="pd-skeleton" style={{ height: 52, marginBottom: 14 }} />
  }

  return (
    <section
      className="pd-panel"
      style={{
        padding: '10px 14px',
        marginBottom: 14,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--pd-text-faint)', marginRight: 4 }}>
          SYSTEM STATUS
        </span>
        {modules.map((m) => (
          <span
            key={m.id}
            title={m.displayName}
            style={{
              fontSize: 10,
              padding: '3px 8px',
              border: '1px solid var(--pd-border-soft)',
              borderRadius: 4,
              color: 'var(--pd-text-dim)',
              background: 'var(--pd-surface-2)',
            }}
          >
            {m.displayName.replace(' Intelligence', '')}
            <span style={{ marginLeft: 6, color: 'var(--pd-accent)' }}>
              {STATE_LABEL[m.state]}
            </span>
          </span>
        ))}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 9, color: 'var(--pd-text-faint)' }}>OVERALL SYSTEM HEALTH</div>
        <div className="pd-num" style={{ fontSize: 16, fontWeight: 700 }}>
          {overallHealth.calibrating || overallHealth.score == null
            ? 'Calibrating'
            : `${Math.round(overallHealth.score)}%`}
        </div>
      </div>
    </section>
  )
}
