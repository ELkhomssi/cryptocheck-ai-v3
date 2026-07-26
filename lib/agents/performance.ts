/**
 * Phase 11 §4 — resolve pending predictions and write performance snapshots.
 * Cards must read snapshots only — never compute % in the render path.
 */

import { fetchPrices } from '@/lib/providers/jupiter'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { listBuiltinEmployees } from '@/lib/agents/roster'
import { writePerformanceSnapshot } from '@/lib/agents/store'
import type { PerformanceFormulaId } from '@/types/agents'

type PredictionRow = {
  id: string
  agent_id: string
  kind: string
  subject: string | null
  payload: Record<string, unknown>
  status: string
  resolve_after: string
}

async function resolvePriceFollowthrough(row: PredictionRow): Promise<'correct' | 'incorrect' | 'expired'> {
  const mint = typeof row.subject === 'string' ? row.subject : typeof row.payload.mint === 'string' ? row.payload.mint : null
  const entry =
    typeof row.payload.entryPriceUsd === 'number'
      ? row.payload.entryPriceUsd
      : typeof row.payload.priceUsd === 'number'
        ? row.payload.priceUsd
        : null
  if (!mint || entry == null || !(entry > 0)) return 'expired'
  const prices = await fetchPrices([mint])
  const now = prices.get(mint)?.priceUsd
  if (now == null || !(now > 0)) return 'expired'
  const direction = row.payload.direction === 'down' ? 'down' : 'up'
  if (direction === 'up') return now >= entry * 1.01 ? 'correct' : 'incorrect'
  return now <= entry * 0.99 ? 'correct' : 'incorrect'
}

/**
 * Resolve due pending predictions (price-based kinds).
 * ~100–800ms estimated depending on pending count.
 */
export async function resolveDuePredictions(limit = 40): Promise<{ resolved: number }> {
  let resolved = 0
  try {
    const admin = getSupabaseAdmin()
    const nowIso = new Date().toISOString()
    const { data, error } = await admin
      .from('agent_predictions')
      .select('*')
      .eq('status', 'pending')
      .lte('resolve_after', nowIso)
      .order('resolve_after', { ascending: true })
      .limit(limit)
    if (error || !data?.length) return { resolved: 0 }

    for (const raw of data) {
      const row = raw as PredictionRow
      let status: 'correct' | 'incorrect' | 'expired' = 'expired'
      try {
        if (
          row.kind === 'setup' ||
          row.kind === 'whale_buy' ||
          row.kind === 'outlook' ||
          row.kind === 'launch_approval'
        ) {
          status = await resolvePriceFollowthrough(row)
        } else {
          status = 'expired'
        }
      } catch {
        status = 'expired'
      }
      await admin
        .from('agent_predictions')
        .update({ status, resolved_at: new Date().toISOString() })
        .eq('id', row.id)
      resolved += 1
    }
  } catch (e) {
    console.error('[agents] resolveDuePredictions', e)
  }
  return { resolved }
}

async function scoreFromPredictions(
  agentId: string,
  formulaId: PerformanceFormulaId,
  minSamples: number,
): Promise<{ score: number | null; sampleSize: number; calibrating: boolean; meta: Record<string, unknown> }> {
  const admin = getSupabaseAdmin()

  if (formulaId === 'news_freshness') {
    const { data } = await admin
      .from('agent_activity')
      .select('created_at')
      .eq('agent_id', agentId)
      .in('kind', ['report', 'signals', 'analysis'])
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
    const last = data?.[0] as { created_at?: string } | undefined
    if (!last?.created_at) {
      return { score: null, sampleSize: 0, calibrating: true, meta: { reason: 'no_scan' } }
    }
    const ageMs = Date.now() - Date.parse(last.created_at)
    const ageHours = ageMs / 3_600_000
    // 100% if scanned within 1h, decays to 0 at 24h
    const score = Math.max(0, Math.min(100, Math.round(100 * (1 - ageHours / 24))))
    return {
      score,
      sampleSize: 1,
      calibrating: false,
      meta: { ageHours: Number(ageHours.toFixed(2)), lastScanAt: last.created_at },
    }
  }

  if (formulaId === 'portfolio_coverage') {
    const { data } = await admin
      .from('agent_activity')
      .select('meta, created_at')
      .eq('agent_id', agentId)
      .eq('kind', 'report')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
    const row = data?.[0] as { meta?: { coveragePct?: number } } | undefined
    const coverage = row?.meta?.coveragePct
    if (typeof coverage !== 'number' || !Number.isFinite(coverage)) {
      return { score: null, sampleSize: 0, calibrating: true, meta: { reason: 'no_coverage' } }
    }
    return {
      score: Math.max(0, Math.min(100, Math.round(coverage))),
      sampleSize: 1,
      calibrating: false,
      meta: { coveragePct: coverage },
    }
  }

  if (formulaId === 'report_completeness') {
    const { data } = await admin
      .from('agent_activity')
      .select('meta')
      .eq('agent_id', agentId)
      .eq('kind', 'report')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20)
    const scores: number[] = []
    for (const r of data ?? []) {
      const c = (r as { meta?: { completeness?: number } }).meta?.completeness
      if (typeof c === 'number' && Number.isFinite(c)) scores.push(c)
    }
    const sampleSize = scores.length
    if (sampleSize < minSamples) {
      return { score: null, sampleSize, calibrating: true, meta: { scores } }
    }
    const avg = scores.reduce((a, b) => a + b, 0) / sampleSize
    return { score: Math.round(avg), sampleSize, calibrating: false, meta: { scores } }
  }

  if (formulaId === 'suggestion_acceptance') {
    const { data } = await admin
      .from('agent_suggestion_feedback')
      .select('decision')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(100)
    const rows = data ?? []
    const sampleSize = rows.length
    if (sampleSize < minSamples) {
      return { score: null, sampleSize, calibrating: true, meta: {} }
    }
    const accepted = rows.filter((r) => (r as { decision: string }).decision === 'accept').length
    const score = Math.round((accepted / sampleSize) * 100)
    return { score, sampleSize, calibrating: false, meta: { accepted } }
  }

  // Default: prediction win-rate formulas
  const { data } = await admin
    .from('agent_predictions')
    .select('status')
    .eq('agent_id', agentId)
    .in('status', ['correct', 'incorrect'])
    .order('resolved_at', { ascending: false })
    .limit(100)
  const rows = data ?? []
  const sampleSize = rows.length
  if (sampleSize < minSamples) {
    return { score: null, sampleSize, calibrating: true, meta: { formulaId } }
  }
  const correct = rows.filter((r) => (r as { status: string }).status === 'correct').length
  const score = Math.round((correct / sampleSize) * 100)
  return { score, sampleSize, calibrating: false, meta: { formulaId, correct } }
}

export async function recomputeAllPerformanceSnapshots(): Promise<{
  agents: number
  resolved: number
}> {
  const { resolved } = await resolveDuePredictions()
  const employees = listBuiltinEmployees()
  for (const emp of employees) {
    try {
      const result = await scoreFromPredictions(
        emp.id,
        emp.performanceFormula.id,
        emp.performanceFormula.minSamples,
      )
      await writePerformanceSnapshot({
        agentId: emp.id,
        score: result.score,
        sampleSize: result.sampleSize,
        calibrating: result.calibrating || result.score == null,
        meta: result.meta,
      })
    } catch (e) {
      console.error('[agents] recompute', emp.id, e)
      await writePerformanceSnapshot({
        agentId: emp.id,
        score: null,
        sampleSize: 0,
        calibrating: true,
        meta: { error: e instanceof Error ? e.message : 'recompute failed' },
      })
    }
  }
  return { agents: employees.length, resolved }
}
