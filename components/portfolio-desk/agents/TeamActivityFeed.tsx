'use client'

import { relativeAge } from '@/lib/portfolio-desk/format'
import type { AgentActivityRow } from '@/types/agents'

export function TeamActivityFeed({
  rows,
  now = Date.now(),
}: {
  rows: AgentActivityRow[]
  now?: number
}) {
  return (
    <div className="pd-panel">
      <div className="pd-panel-head">
        <h2>Team Activity</h2>
        <span style={{ fontSize: 11, color: 'var(--pd-text-faint)' }}>Live from agent_activity</span>
      </div>
      {!rows.length ? (
        <div style={{ padding: '18px', fontSize: 12.5, color: 'var(--pd-text-dim)' }}>
          No agent activity logged yet. Run an employee action to populate this feed.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((row) => (
            <li
              key={row.id}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: '12px 18px',
                borderBottom: '1px solid var(--pd-border-soft)',
                fontSize: 12.5,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-ibm-plex-mono), monospace',
                  fontSize: 11,
                  color: 'var(--pd-text-faint)',
                  minWidth: 64,
                  flexShrink: 0,
                }}
              >
                {relativeAge(row.createdAt, now)}
              </span>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700 }}>{row.agentName}</span>
                <span style={{ color: 'var(--pd-text-dim)' }}> · {row.description || row.kind}</span>
                {row.status === 'running' ? (
                  <span style={{ marginLeft: 8, fontSize: 10.5, color: 'var(--pd-accent)' }}>running</span>
                ) : null}
                {row.status === 'failed' ? (
                  <span style={{ marginLeft: 8, fontSize: 10.5, color: 'var(--pd-negative)' }}>failed</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
