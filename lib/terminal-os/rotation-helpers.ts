/**
 * Thin helpers for capital rotation — avoid circular imports with decision-engine-tick.
 */

import 'server-only'

import {
  listRecentDecisions,
  saveDecision,
  getDecisionIndexIds,
} from '@/lib/terminal-os/decision-store'
import { runDecisionTick } from '@/lib/terminal-os/decision-engine-tick'

export { listRecentDecisions, saveDecision }

export async function runDecisionTickIfNeeded(wallet?: string | null): Promise<void> {
  const ids = await getDecisionIndexIds()
  if (ids.length >= 4) return
  await runDecisionTick({ wallet, limit: 12 })
}
