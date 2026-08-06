/**
 * Phase 17 — AutomationBridge
 * Exposes Automation state to Mission Control / intelligence modules.
 * Execution: POST /api/agents/[agentId]/run + cron /api/cron/automation-recipes
 */

import 'server-only'

import { countRunningTasks, listAgentActivity } from '@/lib/agents/store'
import { AUTOMATION_RECIPES } from '@/lib/portfolio-desk/automation-recipes'
import { countEnabledSchedules } from '@/lib/automation/schedules-store'

/** Recipe catalog — status exposure (shared with AutomationPanel). */
export const AUTOMATION_RECIPE_CATALOG = AUTOMATION_RECIPES.map((r) => ({
  id: r.id,
  title: r.title,
  module: r.module,
  agentId: r.agentId,
}))

export type AutomationBridgeStatus = {
  recipesConfigured: number
  schedulesEnabled: number
  tasksRunning: number
  recentCompletions: Array<{ id: string; description: string; at: string; status: string }>
  /** Honest idle copy when nothing is running. */
  liveThinking: string | null
}

export async function getAutomationBridgeStatus(): Promise<AutomationBridgeStatus> {
  const [tasksRunning, activity, schedulesEnabled] = await Promise.all([
    countRunningTasks(),
    listAgentActivity(20),
    countEnabledSchedules(),
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
    schedulesEnabled,
    tasksRunning,
    recentCompletions,
    liveThinking,
  }
}
