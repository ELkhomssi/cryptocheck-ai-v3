'use client'

import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { ComingOnline } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'

const EMPLOYEES = [
  'Sentinel',
  'Alpha Hunter',
  'Whale Analyst',
  'Portfolio Manager',
  'Risk Manager',
  'Execution Agent',
  'Market Researcher',
  'Coach',
  'Discovery Agent',
  'News Intelligence',
] as const

/** Phase 7 will flesh this out — Phase 1 ships roster shell */
export function AiWorkforcePanel() {
  const autonomy = useTerminalOsStore((s) => s.featureFlags.autonomousTrading)

  return (
    <Panel title="AI Workforce">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 8,
        }}
      >
        {EMPLOYEES.map((name) => (
          <div
            key={name}
            style={{
              border: '1px solid var(--tos-border-subtle)',
              borderRadius: 8,
              padding: 10,
              background: 'var(--tos-bg-panel)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 12 }}>{name}</div>
            <div className="tos-muted" style={{ fontSize: 10, marginTop: 4 }}>
              Status: standby · Conf — · Health —
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <ComingOnline label="Full telemetry dashboard (Phase 7)" />
      </div>
      {!autonomy ? (
        <p className="tos-muted" style={{ fontSize: 10, marginTop: 8 }}>
          Execution Agent cannot act while autonomousTrading flag is OFF.
        </p>
      ) : null}
    </Panel>
  )
}
