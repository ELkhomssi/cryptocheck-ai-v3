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
import { SOL_MINT } from '@/lib/portfolio-desk/constants'

export function QuickSwapCard({ variant = 'default' }: { variant?: 'default' | 'mission' }) {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const walletChainFamily = useTerminalOsStore((s) => s.walletChainFamily)
  const { connectSolana, isConnecting } = useTerminalWallet()
  const query = focused?.id || focused?.symbol || SOL_MINT
  const [builder, setBuilder] = useState<ExecutionBuilderState | null>(null)
  const mission = variant === 'mission'

  const body =
    walletConnected && walletChainFamily === 'evm' ? (
      <>
        <EmptyState message="EVM holdings are live; swap capital path stays Solana/Jupiter for now. Switch to a Solana wallet to execute." />
        <button
          type="button"
          className="tos-btn tos-btn-gold"
          style={{ width: '100%', marginTop: 8, minHeight: 44 }}
          disabled={isConnecting}
          onClick={() => void connectSolana()}
        >
          {isConnecting ? 'Connecting…' : 'Connect Solana Wallet'}
        </button>
      </>
    ) : (
      <div className="tos-mc-swap-stack" data-mission={mission ? 'true' : undefined}>
        <ExecutionBuilder
          query={query}
          presentation={mission ? 'mission' : 'default'}
          onBuilderChange={setBuilder}
        />
        {!walletConnected ? (
          <button
            type="button"
            className="tos-btn tos-btn-gold tos-mc-execute"
            style={{ width: '100%' }}
            disabled={isConnecting}
            onClick={() => void connectSolana()}
          >
            {isConnecting ? 'Connecting…' : 'Connect Wallet to Trade'}
          </button>
        ) : (
          <SecureExecutionPanel
            query={query}
            builder={builder}
            ctaLabel={mission ? 'Execute Trade' : undefined}
          />
        )}
        {mission ? (
          <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 6, lineHeight: 1.35 }}>
            Simulate before sign · slippage + price impact shown · Not financial advice · DYOR
          </p>
        ) : (
          <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 8, lineHeight: 1.35 }}>
            Same engine as Execution Desk · simulate before sign · Not financial advice · DYOR.
          </p>
        )}
      </div>
    )

  if (mission) {
    return <div className="tos-mc-quick-inner">{body}</div>
  }

  return (
    <Panel title="Quick Swap · Secure Execution">
      {body}
    </Panel>
  )
}
