'use client'

/**
 * Execution Desk — Trading Chart (observe→execute) + Secure Execution (protect).
 * Distinct surfaces; never blended with Intelligence Chart overlays.
 */

import { useCallback, useState } from 'react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { ExecutionBuilderState } from '../types'
import { ExecutionBuilder } from './ExecutionBuilder'
import { ExecutionTradingChart } from './ExecutionTradingChart'
import { PositionManager } from './PositionManager'
import { SecureExecutionPanel } from './SecureExecutionPanel'

type DeskTab = 'trading' | 'secure'

export function ExecutionDeskShell() {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const query = focused?.id || focused?.symbol || 'SOL'
  const [tab, setTab] = useState<DeskTab>('trading')
  const [builder, setBuilder] = useState<ExecutionBuilderState | null>(null)

  const onBuilderChange = useCallback((state: ExecutionBuilderState) => {
    setBuilder(state)
  }, [])

  return (
    <div className="ex-root" data-ex-desk>
      <div className="ex-tabs" role="tablist" aria-label="Execution Desk">
        <button
          type="button"
          role="tab"
          className="ex-tab"
          data-active={tab === 'trading'}
          aria-selected={tab === 'trading'}
          onClick={() => setTab('trading')}
        >
          Trading Chart
        </button>
        <button
          type="button"
          role="tab"
          className="ex-tab"
          data-active={tab === 'secure'}
          aria-selected={tab === 'secure'}
          onClick={() => setTab('secure')}
        >
          Secure Execution
        </button>
      </div>

      {tab === 'trading' ? (
        <div className="ex-desk-grid">
          <ExecutionBuilder query={query} onBuilderChange={onBuilderChange} />
          <ExecutionTradingChart query={query} chain={focused?.chain || 'solana'} />
          <PositionManager />
        </div>
      ) : (
        <div className="ex-secure-layout">
          <ExecutionBuilder query={query} onBuilderChange={onBuilderChange} />
          <SecureExecutionPanel query={query} builder={builder} />
        </div>
      )}
    </div>
  )
}
