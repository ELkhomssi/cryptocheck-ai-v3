'use client'

/**
 * Compact Quick Swap — same Secure Execution engine (no second swap path).
 * Always shows the builder so users see quote controls; connect CTA when needed.
 */

import { useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState } from '@/features/terminal-os/shared/components/PanelStates'
import { SecureExecutionPanel } from '@/features/execution-desk/components/SecureExecutionPanel'
import { ExecutionBuilder } from '@/features/execution-desk/components/ExecutionBuilder'
import type { ExecutionBuilderState } from '@/features/execution-desk/types'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useTerminalWallet } from '@/features/terminal-os/wallet/useTerminalWallet'

export function QuickSwapCard() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const walletChainFamily = useTerminalOsStore((s) => s.walletChainFamily)
  const { connectSolana, isConnecting } = useTerminalWallet()
  const query = focused?.id || focused?.symbol || 'SOL'
  const [builder, setBuilder] = useState<ExecutionBuilderState | null>(null)

  if (walletConnected && walletChainFamily === 'evm') {
    return (
      <Panel title="Quick Swap">
        <EmptyState message="Secure Execution is Solana-routed today. Switch to a Solana wallet to execute." />
        <button
          type="button"
          className="tos-btn tos-btn-gold"
          style={{ width: '100%', marginTop: 8 }}
          disabled={isConnecting}
          onClick={() => void connectSolana()}
        >
          {isConnecting ? 'Connecting…' : 'Connect Solana Wallet'}
        </button>
      </Panel>
    )
  }

  return (
    <Panel title="Quick Swap · Secure Execution">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ExecutionBuilder query={query} onBuilderChange={setBuilder} />
        {!walletConnected ? (
          <button
            type="button"
            className="tos-btn tos-btn-gold"
            style={{ width: '100%' }}
            disabled={isConnecting}
            onClick={() => void connectSolana()}
          >
            {isConnecting ? 'Connecting…' : 'Connect Wallet to Swap'}
          </button>
        ) : (
          <SecureExecutionPanel query={query} builder={builder} />
        )}
      </div>
      <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 8, lineHeight: 1.35 }}>
        Same engine as Execution Desk · simulate before sign · Not financial advice · DYOR.
      </p>
    </Panel>
  )
}
