/**
 * Phase 17.2 — TimelineEngine
 * Reads timeline_events (populated by DB triggers). Does not write on app paths.
 *
 * Grep findings (reuse):
 * - agent_activity / portfolio_alerts / terminal_orders remain source writers
 * - Mission Feed previously queried alerts + activity directly — now reads here
 * - No duplicate event pipeline in application code
 */

import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { TimelineEvent } from '@/types/intelligence-core'

function mapRow(row: Record<string, unknown>): TimelineEvent {
  return {
    id: String(row.id),
    sourceTable: String(row.source_table),
    sourceId: String(row.source_id),
    eventType: String(row.event_type),
    summary: String(row.summary ?? ''),
    module: (row.module as string | null) ?? null,
    createdAt: String(row.created_at),
  }
}

export async function listTimelineEvents(params?: {
  limit?: number
  module?: string | null
  sinceIso?: string | null
  untilIso?: string | null
}): Promise<TimelineEvent[]> {
  const limit = Math.min(Math.max(params?.limit ?? 40, 1), 200)
  try {
    const admin = getSupabaseAdmin()
    let q = admin
      .from('timeline_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (params?.module) q = q.eq('module', params.module)
    if (params?.sinceIso) q = q.gte('created_at', params.sinceIso)
    if (params?.untilIso) q = q.lt('created_at', params.untilIso)
    const { data, error } = await q
    if (error || !data) return []
    return data.map((r) => mapRow(r as Record<string, unknown>))
  } catch {
    return []
  }
}

export async function countTimelineEventsInWindow(
  sinceIso: string,
  untilIso: string,
): Promise<number> {
  try {
    const admin = getSupabaseAdmin()
    const { count, error } = await admin
      .from('timeline_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sinceIso)
      .lt('created_at', untilIso)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}
