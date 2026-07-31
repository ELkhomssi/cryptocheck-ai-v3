/**
 * Clear Terminal OS state that depends on an authenticated wallet session.
 * Called on disconnect — no stale Alerts / Coach / TLM data.
 */

import { getTradeLikeMeOrchestrator } from '@/features/terminal-os/ai-trade-like-me/engines/orchestrator'

export function clearWalletDependentClientState() {
  try {
    getTradeLikeMeOrchestrator().resetSession()
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
