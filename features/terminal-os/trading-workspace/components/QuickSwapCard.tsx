'use client'

/**
 * Compact Quick Swap — same Secure Execution engine (no second swap path).
 * Presentation-only wrapper around Execution Desk SecureExecutionPanel.
 */

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState } from '@/features/terminal-os/shared/components/PanelStates'
import { SecureExecutionPanel } from '@/features/execution-desk/components/SecureExecutionPanel'
import { ExecutionBuilder } from '@/features/execution-desk/components/ExecutionBuilder'
import type { ExecutionBuilderState } from '@/features/execution-desk/types'
import { useTerminalOsStore } from '@/stores/terminal-os'

export function QuickSwapCard() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const walletChainFamily = useTerminalOsStore((s) => s.walletChainFamily)
  const query = focused?.id || focused?.symbol || 'SOL'
  const [builder, setBuilder] = useState<ExecutionBuilderState | null>(null)

  useEffect(() => {
    /* builder updates via onBuilderChange */
  }, [query])

  if (walletConnected && walletChainFamily === 'evm') {
    return (
      <Panel title="Quick Swap">
        <EmptyState message="Secure Execution is Solana-routed today. Switch to a Solana wallet to execute." />
      </Panel>
    )
  }

  return (
    <Panel title="Quick Swap · Secure Execution">
      {!walletConnected ? (
        <EmptyState message="Connect a Solana wallet to quote and execute securely." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ExecutionBuilder query={query} onBuilderChange={setBuilder} />
          <SecureExecutionPanel query={query} builder={builder} />
        </div>
      )}
      <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 8, lineHeight: 1.35 }}>
        Same engine as Execution Desk · simulate before sign · Not financial advice · DYOR.
      </p>
    </Panel>
  )
}
