/**
 * Clear Terminal OS state that depends on an authenticated wallet session.
 * Called on disconnect — no stale Alerts / Coach / TLM data.
 */

import { getTradeLikeMeOrchestrator } from '@/features/terminal-os/ai-trade-like-me/engines/orchestrator'
import { useExecutionLifecycleBridge } from '@/features/terminal-os/money-lifecycle/execution-lifecycle-bridge'

export function clearWalletDependentClientState() {
  try {
    getTradeLikeMeOrchestrator().resetSession()
  } catch {
    /* ignore */
  }
  try {
    useExecutionLifecycleBridge.getState().reset()
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem('ccai:tos:coach:cache')
    sessionStorage.removeItem('ccai:tos:alerts:badge')
  } catch {
    /* SSR / private mode */
  }
}
