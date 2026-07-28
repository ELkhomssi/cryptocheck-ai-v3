/**
 * Durable automation schedule persistence.
 */

import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getAutomationRecipe } from '@/lib/portfolio-desk/automation-recipes'

export type AutomationScheduleRow = {
  id: string
  userId: string
  walletAddress: string | null
  recipeId: string
  agentId: string
  action: string
  intervalMinutes: number
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string
  lastStatus: string | null
  lastError: string | null
  lastActivityId: string | null
  createdAt: string
  updatedAt: string
}

function mapRow(row: Record<string, unknown>): AutomationScheduleRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    walletAddress: (row.wallet_address as string | null) ?? null,
    recipeId: String(row.recipe_id),
    agentId: String(row.agent_id),
    action: String(row.action),
    intervalMinutes: Number(row.interval_minutes) || 1440,
    enabled: Boolean(row.enabled),
    lastRunAt: (row.last_run_at as string | null) ?? null,
    nextRunAt: String(row.next_run_at),
    lastStatus: (row.last_status as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    lastActivityId: (row.last_activity_id as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listSchedulesForUser(userId: string): Promise<AutomationScheduleRow[]> {
  const sb = getSupabaseAdmin()
  if (!sb) return []
  const { data, error } = await sb
    .from('automation_schedules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[automation] listSchedulesForUser', error.message)
    return []
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}

export async function upsertSchedule(params: {
  userId: string
  walletAddress?: string | null
  recipeId: string
  enabled: boolean
  intervalMinutes?: number
}): Promise<AutomationScheduleRow | null> {
  const recipe = getAutomationRecipe(params.recipeId)
  if (!recipe) return null
  const sb = getSupabaseAdmin()
  if (!sb) return null

  const interval = params.intervalMinutes ?? recipe.intervalMinutes
  const now = new Date()
  const next = params.enabled
    ? new Date(now.getTime() + interval * 60_000)
    : now

  const { data, error } = await sb
    .from('automation_schedules')
    .upsert(
      {
        user_id: params.userId,
        wallet_address: params.walletAddress ?? null,
        recipe_id: recipe.id,
        agent_id: recipe.agentId,
        action: recipe.action,
        interval_minutes: interval,
        enabled: params.enabled,
        next_run_at: next.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id,recipe_id' },
    )
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('[automation] upsertSchedule', error.message)
    return null
  }
  return data ? mapRow(data as Record<string, unknown>) : null
}

export async function countEnabledSchedules(): Promise<number> {
  const sb = getSupabaseAdmin()
  if (!sb) return 0
  const { count, error } = await sb
    .from('automation_schedules')
    .select('id', { count: 'exact', head: true })
    .eq('enabled', true)
  if (error) return 0
  return count ?? 0
}

/** Claim due schedules for this cron tick (simple read + stamp next_run optimistically). */
export async function claimDueSchedules(limit = 8): Promise<AutomationScheduleRow[]> {
  const sb = getSupabaseAdmin()
  if (!sb) return []
  const nowIso = new Date().toISOString()
  const { data, error } = await sb
    .from('automation_schedules')
    .select('*')
    .eq('enabled', true)
    .lte('next_run_at', nowIso)
    .order('next_run_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[automation] claimDueSchedules', error.message)
    return []
  }

  const rows = (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
  // Push next_run_at forward immediately so concurrent cron ticks don't double-fire.
  await Promise.all(
    rows.map(async (row) => {
      const next = new Date(Date.now() + row.intervalMinutes * 60_000).toISOString()
      await sb
        .from('automation_schedules')
        .update({
          next_run_at: next,
          last_status: 'running',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
    }),
  )
  return rows
}

export async function markScheduleResult(params: {
  id: string
  status: 'completed' | 'failed' | 'skipped'
  error?: string | null
  activityId?: string | null
}): Promise<void> {
  const sb = getSupabaseAdmin()
  if (!sb) return
  await sb
    .from('automation_schedules')
    .update({
      last_run_at: new Date().toISOString(),
      last_status: params.status,
      last_error: params.error ?? null,
      last_activity_id: params.activityId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
}
