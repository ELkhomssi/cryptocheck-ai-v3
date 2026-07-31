'use client'

import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState } from '@/features/terminal-os/shared/components/PanelStates'
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

/** Roster shell — agents map to live engines already wired (scan, whales, coach, execution). */
export function AiWorkforcePanel() {
  const autonomy = useTerminalOsStore((s) => s.featureFlags.autonomousTrading)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)

  return (
    <Panel title="AI Workforce">
      <div className="tos-workforce-grid">
        {EMPLOYEES.map((name) => (
          <div key={name} className="tos-card-tile">
            <div className="tos-card-tile-title">{name}</div>
            <div className="tos-card-tile-meta">
              Status: {walletConnected ? 'listening' : 'standby'} · Conf — · Health —
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'var(--tos-space-3)' }}>
        <EmptyState message="Agents consume the same live scan, whale, coach, and execution engines — open those desks for telemetry." />
      </div>
      {!autonomy ? (
        <p className="tos-muted tos-tlm-rail-note">
          Execution Agent cannot act while autonomousTrading flag is OFF.
        </p>
      ) : null}
    </Panel>
  )
}
