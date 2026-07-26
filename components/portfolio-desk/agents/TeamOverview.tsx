'use client'

import type { TeamOverviewStats } from '@/types/agents'

export function TeamOverview({ stats }: { stats: TeamOverviewStats }) {
  const cards: { label: string; value: string }[] = [
    { label: 'Total Employees', value: String(stats.totalEmployees) },
    { label: 'Active Now', value: String(stats.activeNow) },
    { label: 'Tasks Running', value: String(stats.tasksRunning) },
    { label: 'Alerts Today', value: String(stats.alertsToday) },
    {
      label: 'Success Rate',
      value: stats.successRate == null ? '—' : `${stats.successRate}%`,
    },
  ]

  return (
    <div
      className="pd-team-overview"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}
    >
      {cards.map((c) => (
        <div key={c.label} className="pd-mcard">
          <div className="ml" style={{ color: 'var(--text-faint)' }}>
            {c.label}
          </div>
          <div className="mv" style={{ color: 'var(--text)' }}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  )
}
