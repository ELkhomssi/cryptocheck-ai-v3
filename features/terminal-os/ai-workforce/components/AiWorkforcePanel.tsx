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
      <div className="tos-workforce-grid">
        {EMPLOYEES.map((name) => (
          <div key={name} className="tos-card-tile">
            <div className="tos-card-tile-title">{name}</div>
            <div className="tos-card-tile-meta">Status: standby · Conf — · Health —</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'var(--tos-space-3)' }}>
        <ComingOnline label="Full telemetry dashboard (Phase 7)" />
      </div>
      {!autonomy ? (
        <p className="tos-muted tos-tlm-rail-note">
          Execution Agent cannot act while autonomousTrading flag is OFF.
        </p>
      ) : null}
    </Panel>
  )
}
