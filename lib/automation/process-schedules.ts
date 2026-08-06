/**
 * Cron worker: run due Automation schedules against real AI Employees.
 * Does NOT execute swaps — agents produce reports/signals/activity only.
 */

import 'server-only'

import { runStructuredEmployee } from '@/lib/agents/run-structured'
import { isEntitled } from '@/lib/identity/entitlements'
import {
  claimDueSchedules,
  markScheduleResult,
} from '@/lib/automation/schedules-store'

export type AutomationCronResult = {
  claimed: number
  completed: number
  failed: number
  skipped: number
  details: Array<{
    scheduleId: string
    recipeId: string
    agentId: string
    status: string
    error?: string
  }>
}

export async function processDueAutomationSchedules(
  limit = 8,
): Promise<AutomationCronResult> {
  const due = await claimDueSchedules(limit)
  const out: AutomationCronResult = {
    claimed: due.length,
    completed: 0,
    failed: 0,
    skipped: 0,
    details: [],
  }

  for (const row of due) {
    if (!(await isEntitled(row.userId, 'automation'))) {
      await markScheduleResult({
        id: row.id,
        status: 'skipped',
        error: 'entitlement_required',
      })
      out.skipped += 1
      out.details.push({
        scheduleId: row.id,
        recipeId: row.recipeId,
        agentId: row.agentId,
        status: 'skipped',
        error: 'entitlement_required',
      })
      continue
    }

    const run = await runStructuredEmployee({
      agentId: row.agentId,
      walletAddress: row.walletAddress,
      action: row.action,
      source: `automation-cron:${row.recipeId}`,
      message: `Scheduled automation recipe "${row.recipeId}". Use LIVE CONTEXT only.`,
    })

    if (run.ok) {
      await markScheduleResult({
        id: row.id,
        status: 'completed',
        activityId: run.activityId,
      })
      out.completed += 1
      out.details.push({
        scheduleId: row.id,
        recipeId: row.recipeId,
        agentId: row.agentId,
        status: 'completed',
      })
    } else {
      await markScheduleResult({
        id: row.id,
        status: 'failed',
        error: run.error,
        activityId: run.activityId ?? null,
      })
      out.failed += 1
      out.details.push({
        scheduleId: row.id,
        recipeId: row.recipeId,
        agentId: row.agentId,
        status: 'failed',
        error: run.error,
      })
    }
  }

  return out
}
