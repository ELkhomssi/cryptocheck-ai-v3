'use client'

/**
 * Phase 16.3 — Intelligence Module card.
 * Worker count / stats / score come from API queries — no literals.
 */

import { PerformanceRing } from '@/components/portfolio-desk/agents/PerformanceRing'
import type { ModuleCardView } from '@/types/intelligence'

const STATE_LABEL: Record<ModuleCardView['state'], string> = {
  running: 'Running',
  investigating: 'Investigating',
  waiting: 'Waiting',
  idle: 'Idle',
}

function formatStat(value: number | null, unit?: string): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const n =
    Math.abs(value) >= 1000
      ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : Number.isInteger(value)
        ? String(value)
        : value.toFixed(1)
  return unit ? `${n}${unit === '%' || unit === 'ms' ? unit : ` ${unit}`}` : n
}

export function IntelligenceModuleCard({
  module,
  onOpen,
}: {
  module: ModuleCardView
  onOpen: (id: ModuleCardView['id']) => void
}) {
  return (
    <button
      type="button"
      className="pd-panel"
      onClick={() => onOpen(module.id)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: 14,
        cursor: 'pointer',
        border: '1px solid var(--pd-border-soft)',
        background: 'var(--pd-surface)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{module.displayName}</div>
          <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span
              className="pd-tab is-active"
              style={{
                fontSize: 10,
                padding: '2px 8px',
                pointerEvents: 'none',
              }}
            >
              {STATE_LABEL[module.state]}
              {module.state === 'investigating' && module.investigationTarget
                ? ` · ${module.investigationTarget.slice(0, 12)}`
                : ''}
            </span>
            <span className="pd-num" style={{ fontSize: 10, color: 'var(--pd-text-faint)' }}>
              {module.workerCount} worker{module.workerCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <PerformanceRing
          score={module.score}
          calibrating={module.calibrating}
          size={48}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(module.stats.length, 3)}, minmax(0, 1fr))`,
          gap: 8,
        }}
      >
        {module.stats.map((s) => (
          <div key={s.key}>
            <div style={{ fontSize: 9, color: 'var(--pd-text-faint)', letterSpacing: '0.04em' }}>
              {s.label.toUpperCase()}
            </div>
            <div className="pd-num" style={{ fontSize: 14, fontWeight: 600 }} title={s.note}>
              {formatStat(s.value, s.unit)}
            </div>
          </div>
        ))}
      </div>
      {module.calibrating && module.calibratingReason ? (
        <p style={{ margin: '8px 0 0', fontSize: 10, color: 'var(--pd-text-faint)' }}>
          Calibrating — {module.calibratingReason}
        </p>
      ) : null}
    </button>
  )
}
