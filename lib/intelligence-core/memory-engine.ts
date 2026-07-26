/**
 * Phase 17.7 — MemoryEngine
 * Append-only user interaction history. Does NOT duplicate watchlist / agent_activity.
 *
 * Grep findings (reuse, do not duplicate):
 * - watchlist table = source of truth for tracked tokens
 * - agent_activity = worker runs (not user preference history)
 * - intelligence_module_memory = module-day Y/T/T (Phase 16) — different concern
 */

import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { UserMemoryActionType, UserMemoryRow } from '@/types/intelligence-core'

function mapRow(row: Record<string, unknown>): UserMemoryRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    actionType: row.action_type as UserMemoryActionType,
    subjectType: String(row.subject_type ?? 'unknown'),
    subjectId: (row.subject_id as string | null) ?? null,
    meta: (row.meta as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

export async function recordUserMemory(params: {
  userId: string
  actionType: UserMemoryActionType
  subjectType: string
  subjectId?: string | null
  meta?: Record<string, unknown>
}): Promise<string | null> {
  if (!params.userId.trim()) return null
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('user_memory')
      .insert({
        user_id: params.userId.trim(),
        action_type: params.actionType,
        subject_type: params.subjectType,
        subject_id: params.subjectId ?? null,
        meta: params.meta ?? {},
      })
      .select('id')
      .single()
    if (error) {
      console.error('[intelligence-core] recordUserMemory', error.message)
      return null
    }
    return data?.id ? String(data.id) : null
  } catch (e) {
    console.error('[intelligence-core] recordUserMemory unavailable', e)
    return null
  }
}

export async function listUserMemory(
  userId: string,
  limit = 40,
): Promise<UserMemoryRow[]> {
  if (!userId.trim()) return []
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100))
    if (error || !data) return []
    return data.map((r) => mapRow(r as Record<string, unknown>))
  } catch {
    return []
  }
}

export type MemoryAggregates = {
  favoriteSubjectTypes: Array<{ subjectType: string; count: number }>
  frequentSubjects: Array<{ subjectId: string; count: number }>
  actionCounts: Record<string, number>
}

/** Lightweight frequency aggregates for RecommendationEngine / Coach. */
export async function aggregateUserMemory(userId: string): Promise<MemoryAggregates> {
  const rows = await listUserMemory(userId, 200)
  const typeCounts = new Map<string, number>()
  const subjectCounts = new Map<string, number>()
  const actionCounts: Record<string, number> = {}

  for (const r of rows) {
    typeCounts.set(r.subjectType, (typeCounts.get(r.subjectType) ?? 0) + 1)
    if (r.subjectId) {
      subjectCounts.set(r.subjectId, (subjectCounts.get(r.subjectId) ?? 0) + 1)
    }
    actionCounts[r.actionType] = (actionCounts[r.actionType] ?? 0) + 1
  }

  const favoriteSubjectTypes = [...typeCounts.entries()]
    .map(([subjectType, count]) => ({ subjectType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const frequentSubjects = [...subjectCounts.entries()]
    .map(([subjectId, count]) => ({ subjectId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  return { favoriteSubjectTypes, frequentSubjects, actionCounts }
}
