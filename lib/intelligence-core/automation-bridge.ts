/**
 * Phase 17 — AutomationBridge
 * Exposes existing Automation (Phase 14/15) state to Mission Control.
 * Does NOT reimplement scheduling, budgets, or lifecycle logic.
 *
 * Grep findings (reuse):
 * - AutomationPanel recipes are UI-side constants → mirrored here as status catalog only
 * - Execution remains POST /api/agents/[agentId]/run
 * - Running state from agent_activity (listAgentActivity / countRunningTasks)
 */

import 'server-only'

import { countRunningTasks, listAgentActivity } from '@/lib/agents/store'

/** Recipe catalog mirrored from AutomationPanel — status exposure only. */
export const AUTOMATION_RECIPE_CATALOG = [
  {
    id: 'daily-outlook',
    title: 'Daily market outlook',
    module: 'research' as const,
  },
  {
    id: 'liquidity-watch',
    title: 'Liquidity change scan',
    module: 'market' as const,
  },
  {
    id: 'portfolio-audit',
    title: 'Portfolio risk audit',
    module: 'portfolio' as const,
  },
  {
    id: 'whale-monitor',
    title: 'Whale / smart-money pulse',
    module: 'market' as const,
  },
] as const

export type AutomationBridgeStatus = {
  recipesConfigured: number
  tasksRunning: number
  recentCompletions: Array<{ id: string; description: string; at: string; status: string }>
  /** Honest idle copy when nothing is running. */
  liveThinking: string | null
}

export async function getAutomationBridgeStatus(): Promise<AutomationBridgeStatus> {
  const [tasksRunning, activity] = await Promise.all([
    countRunningTasks(),
    listAgentActivity(20),
  ])

  const running = activity.filter((a) => a.status === 'running')
  const recentCompletions = activity
    .filter((a) => a.status !== 'running')
    .slice(0, 8)
    .map((a) => ({
      id: a.id,
      description: a.description || `${a.kind} ${a.status}`,
      at: a.createdAt,
      status: a.status,
    }))

  // Phase 17.8 — reuse Alive-Never-Fake: only show progress copy bound to real running rows.
  let liveThinking: string | null = null
  if (running.length > 0) {
    const d = (running[0]?.description || '').toLowerCase()
    if (d.includes('scan') || d.includes('report')) liveThinking = 'Scanning…'
    else if (d.includes('liquidity')) liveThinking = 'Checking liquidity…'
    else if (d.includes('report') || d.includes('brief')) liveThinking = 'Building report…'
    else liveThinking = running[0]?.description || 'Working…'
  }

  return {
    recipesConfigured: AUTOMATION_RECIPE_CATALOG.length,
    tasksRunning,
    recentCompletions,
    liveThinking,
  }
}
