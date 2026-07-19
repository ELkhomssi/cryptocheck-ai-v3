import 'server-only'

import { randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { logUserBlock } from '@/lib/launchpad/saved-you'
import type { CoachVerdict, WatchDegradeEvent } from './constants'

export async function insertWatchDegradeEvent(input: {
  userId: string
  mint: string
  prevVerdict: CoachVerdict
  newVerdict: CoachVerdict
  prevRisk: number | null
  newRisk: number | null
  reason: string
  held: boolean
}): Promise<WatchDegradeEvent | null> {
  const id = randomUUID()
  const ts = new Date().toISOString()
  try {
    const sb = getSupabaseAdmin()
    const { error } = await sb.from('watch_degrade_events').insert({
      id,
      user_id: input.userId,
      mint: input.mint,
      prev_verdict: input.prevVerdict,
      new_verdict: input.newVerdict,
      prev_risk: input.prevRisk,
      new_risk: input.newRisk,
      reason: input.reason,
      held: input.held,
      created_at: ts,
    })
    if (error) {
      console.error('[personal-watch] insertWatchDegradeEvent', error.message)
      return null
    }
  } catch (e) {
    console.error('[personal-watch] insertWatchDegradeEvent', e)
    return null
  }

  // DANGER degrade → feed existing Saved-You engine (source=watch), not a parallel system.
  if (input.newVerdict === 'DANGER') {
    await logUserBlock({
      userId: input.userId,
      mint: input.mint,
      verdict: 'DANGER',
      score: input.newRisk ?? undefined,
      evidence: `Watch degrade: ${input.reason}`,
      source: 'watch',
    })
  }

  return {
    id,
    userId: input.userId,
    mint: input.mint,
    prevVerdict: input.prevVerdict,
    newVerdict: input.newVerdict,
    prevRisk: input.prevRisk,
    newRisk: input.newRisk,
    reason: input.reason,
    held: input.held,
    ts,
  }
}

export async function listWatchDegradeEventsForUser(
  userId: string,
  limit = 20,
): Promise<WatchDegradeEvent[]> {
  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('watch_degrade_events')
      .select(
        'id, user_id, mint, prev_verdict, new_verdict, prev_risk, new_risk, reason, held, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return (data ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      mint: r.mint,
      prevVerdict: r.prev_verdict as CoachVerdict,
      newVerdict: r.new_verdict as CoachVerdict,
      prevRisk: r.prev_risk,
      newRisk: r.new_risk,
      reason: r.reason,
      held: Boolean(r.held),
      ts: r.created_at,
    }))
  } catch {
    return []
  }
}

export async function countWatchDegradesSince(userId: string, sinceIso: string): Promise<number> {
  try {
    const sb = getSupabaseAdmin()
    const { count, error } = await sb
      .from('watch_degrade_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}
