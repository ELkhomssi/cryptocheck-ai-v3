/**
 * Mirrors Execution Desk ExecutionState for the Money Lifecycle ribbon.
 * SecureExecutionPanel writes; ribbon reads — no second execution path.
 */

import { create } from 'zustand'
import type { ExecutionState } from '@/features/execution-desk/types'

interface ExecutionLifecycleBridge {
  executionState: ExecutionState
  lastSignature: string | null
  setExecutionState: (state: ExecutionState) => void
  setLastSignature: (sig: string | null) => void
  reset: () => void
}

export const useExecutionLifecycleBridge = create<ExecutionLifecycleBridge>((set) => ({
  executionState: 'building',
  lastSignature: null,
  setExecutionState: (executionState) => set({ executionState }),
  setLastSignature: (lastSignature) => set({ lastSignature }),
  reset: () => set({ executionState: 'building', lastSignature: null }),
}))

export const IN_FLIGHT_EXECUTION: ReadonlySet<ExecutionState> = new Set([
  'simulating',
  'awaiting_signature',
  'broadcasting',
  'pending_confirmation',
])
