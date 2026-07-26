/**
 * Phase 16.2 — Intelligence Score formula (exact).
 *
 * score = weighted_average(
 *   avg(worker.performance) across non-Calibrating workers in module,  weight 0.5
 *   provider_uptime_pct (last 24h),                                    weight 0.3
 *   data_freshness (1.0 if last sync < expected interval, else decay), weight 0.2
 * )
 *
 * Calibrating thresholds (INTEL_SCORE_THRESHOLDS in types/intelligence.ts):
 * - < 2 non-Calibrating workers with a real score → Calibrating
 * - < 6 provider probes OR history span < 24h → Calibrating
 * - If every mapped worker is Calibrating → Calibrating (no fabricated %)
 */

import { latestPerformanceSnapshots } from '@/lib/agents/store'
import {
  getModuleDef,
  INTELLIGENCE_MODULES,
  workerIdsForModule,
} from '@/lib/intelligence/modules'
import {
  getProviderLastOkMs,
  getProviderUptimePct,
  providersForDataSources,
  recordProviderProbe,
  type IntelProviderId,
} from '@/lib/intelligence/provider-probes'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  INTEL_SCORE_THRESHOLDS,
  type IntelligenceModuleId,
  type IntelligenceScoreResult,
  type IntelligenceScoreSnapshot,
} from '@/types/intelligence'

function freshnessPct(lastOkMs: number | null, expectedIntervalMs: number): number | null {
  if (lastOkMs == null) return null
  const age = Date.now() - lastOkMs
  if (age <= expectedIntervalMs) return 100
  // Linear decay from 100 → 0 over 4× expected interval past due.
  const overdue = age - expectedIntervalMs
  const decayWindow = expectedIntervalMs * 4
  const pct = Math.max(0, 100 * (1 - overdue / decayWindow))
  return Math.round(pct * 100) / 100
}

export async function computeModuleIntelligenceScore(
  moduleId: IntelligenceModuleId,
): Promise<IntelligenceScoreResult> {
  const def = getModuleDef(moduleId)
  const workerIds = workerIdsForModule(moduleId)
  const snaps = await latestPerformanceSnapshots(workerIds)

  const nonCalibrating: number[] = []
  let allCalibrating = workerIds.length > 0
  for (const id of workerIds) {
    const s = snaps.get(id)
    if (s && !s.calibrating && s.score != null && Number.isFinite(s.score)) {
      nonCalibrating.push(s.score)
      allCalibrating = false
    }
  }
  if (workerIds.length === 0) allCalibrating = true

  const avgWorkerPerformance =
    nonCalibrating.length > 0
      ? Math.round(
          (nonCalibrating.reduce((a, b) => a + b, 0) / nonCalibrating.length) * 100,
        ) / 100
      : null

  const providerIds = providersForDataSources(def?.dataSources ?? [])
  let uptimeSum = 0
  let uptimeN = 0
  let probeCount = 0
  let oldestSpan: number | null = null
  for (const pid of providerIds) {
    const u = await getProviderUptimePct(pid)
    probeCount += u.probesInWindow
    if (u.oldestProbeAgeMs != null) {
      oldestSpan = oldestSpan == null ? u.oldestProbeAgeMs : Math.max(oldestSpan, u.oldestProbeAgeMs)
    }
    if (u.uptimePct != null) {
      uptimeSum += u.uptimePct
      uptimeN++
    }
  }
  const providerUptimePct =
    uptimeN > 0 ? Math.round((uptimeSum / uptimeN) * 100) / 100 : null

  let freshSum = 0
  let freshN = 0
  const expected = def?.expectedSyncIntervalMs ?? 15 * 60_000
  for (const pid of providerIds) {
    const last = await getProviderLastOkMs(pid)
    const f = freshnessPct(last, expected)
    if (f != null) {
      freshSum += f
      freshN++
    }
  }
  const dataFreshnessPct =
    freshN > 0 ? Math.round((freshSum / freshN) * 100) / 100 : null

  const components = {
    avgWorkerPerformance,
    providerUptimePct,
    dataFreshnessPct,
  }

  let calibrating = false
  let calibratingReason: string | null = null

  if (allCalibrating || nonCalibrating.length === 0) {
    calibrating = true
    calibratingReason = 'All mapped workers are still Calibrating — no performance % yet.'
  } else if (nonCalibrating.length < INTEL_SCORE_THRESHOLDS.MIN_NON_CALIBRATING_WORKERS) {
    calibrating = true
    calibratingReason = `Need ≥${INTEL_SCORE_THRESHOLDS.MIN_NON_CALIBRATING_WORKERS} non-Calibrating workers (have ${nonCalibrating.length}).`
  } else if (
    providerUptimePct == null ||
    probeCount < INTEL_SCORE_THRESHOLDS.MIN_UPTIME_PROBE_COUNT ||
    (oldestSpan != null && oldestSpan < INTEL_SCORE_THRESHOLDS.MIN_UPTIME_HISTORY_MS) ||
    oldestSpan == null
  ) {
    calibrating = true
    calibratingReason =
      'Need ≥24h of provider uptime probe history (≥6 probes) before scoring.'
  } else if (dataFreshnessPct == null) {
    calibrating = true
    calibratingReason = 'No last-successful provider sync timestamps yet.'
  }

  let score: number | null = null
  if (!calibrating && avgWorkerPerformance != null && providerUptimePct != null && dataFreshnessPct != null) {
    score =
      Math.round(
        (INTEL_SCORE_THRESHOLDS.WEIGHT_WORKER_PERF * avgWorkerPerformance +
          INTEL_SCORE_THRESHOLDS.WEIGHT_PROVIDER_UPTIME * providerUptimePct +
          INTEL_SCORE_THRESHOLDS.WEIGHT_DATA_FRESHNESS * dataFreshnessPct) *
          100,
      ) / 100
  }

  return {
    moduleId,
    score,
    calibrating: calibrating || score == null,
    calibratingReason: score == null ? calibratingReason : null,
    components,
    computedAt: new Date().toISOString(),
  }
}

export async function writeIntelligenceScoreSnapshot(
  result: IntelligenceScoreResult,
): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    await admin.from('intelligence_score_snapshots').insert({
      module_id: result.moduleId,
      score: result.calibrating ? null : result.score,
      calibrating: result.calibrating || result.score == null,
      avg_worker_performance: result.components.avgWorkerPerformance,
      provider_uptime_pct: result.components.providerUptimePct,
      data_freshness_pct: result.components.dataFreshnessPct,
      meta: {
        calibratingReason: result.calibratingReason,
      },
      computed_at: result.computedAt,
    })
  } catch (e) {
    console.error('[intelligence] writeIntelligenceScoreSnapshot', e)
  }
}

export async function recomputeAllIntelligenceScores(): Promise<{
  modules: IntelligenceScoreResult[]
}> {
  const modules: IntelligenceScoreResult[] = []
  for (const def of INTELLIGENCE_MODULES) {
    const result = await computeModuleIntelligenceScore(def.id)
    await writeIntelligenceScoreSnapshot(result)
    modules.push(result)
  }
  return { modules }
}

function mapSnapshot(row: Record<string, unknown>): IntelligenceScoreSnapshot {
  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }
  return {
    id: String(row.id),
    moduleId: row.module_id as IntelligenceModuleId,
    score: num(row.score),
    calibrating: row.calibrating !== false,
    avgWorkerPerformance: num(row.avg_worker_performance),
    providerUptimePct: num(row.provider_uptime_pct),
    dataFreshnessPct: num(row.data_freshness_pct),
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    computedAt: String(row.computed_at),
  }
}

/** History for graphs — no synthetic fill; gaps remain gaps. */
export async function listIntelligenceScoreHistory(
  moduleId: IntelligenceModuleId,
  days = 7,
): Promise<IntelligenceScoreSnapshot[]> {
  try {
    const admin = getSupabaseAdmin()
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await admin
      .from('intelligence_score_snapshots')
      .select('*')
      .eq('module_id', moduleId)
      .gte('computed_at', since)
      .order('computed_at', { ascending: true })
      .limit(800)
    if (error || !data) return []
    return data.map((r) => mapSnapshot(r as Record<string, unknown>))
  } catch {
    return []
  }
}

/** Latest snapshot per module (for cards / system strip). */
export async function latestIntelligenceScores(): Promise<
  Map<IntelligenceModuleId, IntelligenceScoreSnapshot>
> {
  const out = new Map<IntelligenceModuleId, IntelligenceScoreSnapshot>()
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('intelligence_score_snapshots')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(60)
    if (error || !data) return out
    for (const row of data) {
      const snap = mapSnapshot(row as Record<string, unknown>)
      if (!out.has(snap.moduleId)) out.set(snap.moduleId, snap)
    }
  } catch {
    /* empty */
  }
  return out
}

/**
 * Overall System Health = weighted average of non-Calibrating module scores.
 * If fewer than MIN_SCORED_MODULES_FOR_OVERALL have a real score → Calibrating.
 */
export function computeOverallSystemHealth(
  scores: Array<{ score: number | null; calibrating: boolean }>,
): { score: number | null; calibrating: boolean } {
  const real = scores.filter((s) => !s.calibrating && s.score != null && Number.isFinite(s.score))
  if (real.length < INTEL_SCORE_THRESHOLDS.MIN_SCORED_MODULES_FOR_OVERALL) {
    return { score: null, calibrating: true }
  }
  const avg =
    real.reduce((a, b) => a + (b.score as number), 0) / real.length
  return { score: Math.round(avg * 100) / 100, calibrating: false }
}

/** Live probe used by the hourly cron — records into Redis history. */
export async function probeAndRecordProviders(): Promise<
  Record<IntelProviderId, { ok: boolean; latencyMs: number | null }>
> {
  const out = {} as Record<IntelProviderId, { ok: boolean; latencyMs: number | null }>

  async function timed(fn: () => Promise<void>): Promise<{ ok: boolean; latencyMs: number }> {
    const t0 = Date.now()
    try {
      await fn()
      return { ok: true, latencyMs: Date.now() - t0 }
    } catch {
      return { ok: false, latencyMs: Date.now() - t0 }
    }
  }

  {
    const r = await timed(async () => {
      const { fetchPrices } = await import('@/lib/providers/jupiter')
      const map = await fetchPrices(['So11111111111111111111111111111111111111112'])
      if (!map.size) throw new Error('empty')
    })
    await recordProviderProbe('jupiter', r.ok, r.latencyMs)
    out.jupiter = r
  }

  {
    const configured = Boolean(process.env.BIRDEYE_API_KEY?.trim())
    if (!configured) {
      await recordProviderProbe('birdeye', false, null)
      out.birdeye = { ok: false, latencyMs: null }
    } else {
      const r = await timed(async () => {
        const { fetchTokenList } = await import('@/lib/providers/birdeye')
        const list = await fetchTokenList({ limit: 1, sortBy: 'volume', sortType: 'desc' })
        if (!list.length) throw new Error('empty')
      })
      await recordProviderProbe('birdeye', r.ok, r.latencyMs)
      out.birdeye = r
    }
  }

  {
    const configured = Boolean(
      process.env.HELIUS_RPC_URL?.trim() || process.env.HELIUS_API_KEY?.trim(),
    )
    if (!configured) {
      await recordProviderProbe('helius', false, null)
      out.helius = { ok: false, latencyMs: null }
    } else {
      const r = await timed(async () => {
        const { rpc } = await import('@/lib/providers/helius')
        const slot = await rpc('getSlot', [])
        if (slot == null) throw new Error('null slot')
      })
      await recordProviderProbe('helius', r.ok, r.latencyMs)
      out.helius = r
    }
  }

  {
    const configured = Boolean(
      process.env.NEWS_API_KEY?.trim() ||
        process.env.CRYPTONEWS_API_KEY?.trim() ||
        process.env.NEWS_SENTIMENT_API_KEY?.trim(),
    )
    if (!configured) {
      // Unconfigured news is not a down probe that tanks Research — skip recording failures.
      out.news = { ok: false, latencyMs: null }
    } else {
      // Soft OK probe: key present counts as configured; deep news fetch is provider-specific.
      await recordProviderProbe('news', true, 0)
      out.news = { ok: true, latencyMs: 0 }
    }
  }

  return out
}
