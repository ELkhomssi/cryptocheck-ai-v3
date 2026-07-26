/**
 * Phase 16.3 — per-module stats from real queries / Redis counters.
 * No invented round numbers — null/0 with an honest note when source is empty.
 */

import { Redis } from '@upstash/redis'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { workerIdsForModule } from '@/lib/intelligence/modules'
import type { IntelligenceModuleId, ModuleStat } from '@/types/intelligence'

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  try {
    return Redis.fromEnv()
  } catch {
    return null
  }
}

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Redis day counters — incremented by live ingest / quote paths. */
export const INTEL_COUNTER_KEYS = {
  marketDatapoints: (day = utcDayKey()) => `ccai:intel:stat:market:datapoints:${day}`,
  jupiterQuotes: (day = utcDayKey()) => `ccai:intel:stat:trading:quotes:${day}`,
  jupiterQuoteLatencySum: (day = utcDayKey()) =>
    `ccai:intel:stat:trading:quote_latency_sum_ms:${day}`,
} as const

export async function incrMarketDatapoints(n: number): Promise<void> {
  if (!(n > 0)) return
  const r = getRedis()
  if (!r) return
  try {
    const key = INTEL_COUNTER_KEYS.marketDatapoints()
    // Upstash incrby
    await r.incrby(key, Math.floor(n))
    await r.expire(key, 3 * 24 * 60 * 60)
  } catch {
    /* best-effort */
  }
}

export async function recordJupiterQuoteLatency(latencyMs: number): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    const day = utcDayKey()
    const qKey = INTEL_COUNTER_KEYS.jupiterQuotes(day)
    const sKey = INTEL_COUNTER_KEYS.jupiterQuoteLatencySum(day)
    await r.incr(qKey)
    await r.incrby(sKey, Math.max(0, Math.round(latencyMs)))
    await r.expire(qKey, 3 * 24 * 60 * 60)
    await r.expire(sKey, 3 * 24 * 60 * 60)
  } catch {
    /* best-effort */
  }
}

async function redisInt(key: string): Promise<number | null> {
  const r = getRedis()
  if (!r) return null
  try {
    const v = await r.get<number | string>(key)
    if (v == null) return 0
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : 0
  } catch {
    return null
  }
}

function startOfUtcDayIso(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

async function countActivityToday(params: {
  agentIds: string[]
  kinds?: string[]
  status?: string
  flaggedRisk?: boolean
}): Promise<number> {
  if (!params.agentIds.length) return 0
  try {
    const admin = getSupabaseAdmin()
    let q = admin
      .from('agent_activity')
      .select('id', { count: 'exact', head: true })
      .in('agent_id', params.agentIds)
      .gte('created_at', startOfUtcDayIso())
    if (params.kinds?.length) q = q.in('kind', params.kinds)
    if (params.status) q = q.eq('status', params.status)
    const { count, error } = await q
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

async function countWhaleAlertsToday(): Promise<number> {
  try {
    const admin = getSupabaseAdmin()
    const { count, error } = await admin
      .from('portfolio_alerts')
      .select('id', { count: 'exact', head: true })
      .in('type', ['whale', 'whale_buy', 'whale_sell'])
      .gte('created_at', startOfUtcDayIso())
    if (error) {
      // Fallback: agent_activity signals from whale-analyst
      return countActivityToday({
        agentIds: ['whale-analyst'],
        kinds: ['signals'],
        status: 'completed',
      })
    }
    return count ?? 0
  } catch {
    return countActivityToday({
      agentIds: ['whale-analyst'],
      kinds: ['signals'],
      status: 'completed',
    })
  }
}

async function countFlaggedThreatsToday(agentIds: string[]): Promise<number> {
  if (!agentIds.length) return 0
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('agent_activity')
      .select('id, meta')
      .in('agent_id', agentIds)
      .eq('status', 'completed')
      .gte('created_at', startOfUtcDayIso())
      .limit(500)
    if (error || !data) return 0
    return data.filter((row) => {
      const meta = (row.meta as Record<string, unknown> | null) ?? {}
      const risk = meta.riskScore ?? meta.risk ?? meta.severity
      if (typeof risk === 'number' && risk >= 70) return true
      if (typeof risk === 'string' && ['high', 'critical', 'danger'].includes(risk.toLowerCase()))
        return true
      if (meta.flagged === true || meta.threat === true) return true
      return false
    }).length
  } catch {
    return 0
  }
}

async function countDistinctLaunchSubjects(): Promise<number> {
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('agent_predictions')
      .select('subject')
      .eq('agent_id', 'launch-advisor')
      .not('subject', 'is', null)
      .limit(500)
    if (error || !data) {
      // Fall back to distinct mints mentioned in today's launch-advisor activity meta
      const { data: acts } = await admin
        .from('agent_activity')
        .select('meta')
        .eq('agent_id', 'launch-advisor')
        .gte('created_at', startOfUtcDayIso())
        .limit(200)
      const set = new Set<string>()
      for (const row of acts ?? []) {
        const meta = (row.meta as Record<string, unknown> | null) ?? {}
        const mint = meta.mint ?? meta.targetMint ?? meta.subject
        if (typeof mint === 'string' && mint.length >= 32) set.add(mint)
      }
      return set.size
    }
    return new Set(
      data
        .map((r) => (r as { subject: string | null }).subject)
        .filter((s): s is string => typeof s === 'string' && s.length > 0),
    ).size
  } catch {
    return 0
  }
}

async function portfolioMetricsFromDb(): Promise<{
  health: number | null
  risk: number | null
  allocationHhi: number | null
}> {
  // Phase 10 analytics are wallet-scoped; module card shows aggregate coverage from
  // risk-manager performance meta when present, else honest nulls.
  try {
    const admin = getSupabaseAdmin()
    const { data } = await admin
      .from('agent_performance_snapshots')
      .select('score, meta, calibrating, computed_at')
      .eq('agent_id', 'risk-manager')
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return { health: null, risk: null, allocationHhi: null }
    const meta = (data.meta as Record<string, unknown> | null) ?? {}
    const health =
      typeof meta.healthScore === 'number'
        ? meta.healthScore
        : data.calibrating
          ? null
          : typeof data.score === 'number'
            ? data.score
            : null
    const risk = typeof meta.riskScore === 'number' ? meta.riskScore : null
    const allocationHhi = typeof meta.hhi === 'number' ? meta.hhi : null
    return { health, risk, allocationHhi }
  } catch {
    return { health: null, risk: null, allocationHhi: null }
  }
}

export async function queryModuleStats(
  moduleId: IntelligenceModuleId,
): Promise<ModuleStat[]> {
  const workers = workerIdsForModule(moduleId)

  switch (moduleId) {
    case 'market': {
      const datapoints = await redisInt(INTEL_COUNTER_KEYS.marketDatapoints())
      const signals = await countActivityToday({
        agentIds: workers,
        kinds: ['signals'],
      })
      const whales = await countWhaleAlertsToday()
      return [
        {
          key: 'datapoints',
          label: 'Datapoints analyzed',
          value: datapoints,
          note:
            datapoints == null
              ? 'Counter unavailable (Redis not configured)'
              : undefined,
        },
        { key: 'signals', label: 'Market signals', value: signals },
        { key: 'whales', label: 'Whale movements', value: whales },
      ]
    }
    case 'security': {
      const contracts = await countActivityToday({
        agentIds: workers.filter((id) =>
          ['scam-investigator'].includes(id),
        ),
        kinds: ['report', 'analysis'],
        status: 'completed',
      })
      const threats = await countFlaggedThreatsToday(workers)
      return [
        { key: 'contracts', label: 'Contracts analyzed', value: contracts },
        { key: 'threats', label: 'Threats detected', value: threats },
      ]
    }
    case 'trading': {
      const quotes = await redisInt(INTEL_COUNTER_KEYS.jupiterQuotes())
      const sum = await redisInt(INTEL_COUNTER_KEYS.jupiterQuoteLatencySum())
      const latency =
        quotes != null && sum != null && quotes > 0
          ? Math.round(sum / quotes)
          : quotes === 0
            ? null
            : null
      return [
        {
          key: 'simulations',
          label: 'Simulations',
          value: quotes,
          note: quotes == null ? 'Counter unavailable (Redis not configured)' : undefined,
        },
        {
          key: 'latency',
          label: 'Execution latency',
          value: latency,
          unit: 'ms',
          note: latency == null ? 'No Jupiter quote samples today' : undefined,
        },
      ]
    }
    case 'portfolio': {
      const m = await portfolioMetricsFromDb()
      return [
        {
          key: 'health',
          label: 'Health',
          value: m.health,
          unit: m.health != null ? '%' : undefined,
          note: m.health == null ? 'Awaiting Risk Manager coverage snapshot' : undefined,
        },
        {
          key: 'risk',
          label: 'Risk',
          value: m.risk,
          note: m.risk == null ? 'No computed risk score in latest snapshot meta' : undefined,
        },
        {
          key: 'allocation',
          label: 'Allocation HHI',
          value: m.allocationHhi,
          note: m.allocationHhi == null ? 'No HHI in latest snapshot meta' : undefined,
        },
      ]
    }
    case 'launch': {
      const projects = await countDistinctLaunchSubjects()
      return [
        { key: 'projects', label: 'Projects monitored', value: projects },
      ]
    }
    case 'research': {
      const research = await countActivityToday({
        agentIds: ['research-analyst'],
        kinds: ['report', 'analysis'],
        status: 'completed',
      })
      const macro = await countActivityToday({
        agentIds: ['market-strategist'],
        kinds: ['analysis', 'report'],
        status: 'completed',
      })
      const news = await countActivityToday({
        agentIds: ['news-intelligence'],
        kinds: ['report'],
        status: 'completed',
      })
      return [
        { key: 'research', label: 'Research runs', value: research },
        { key: 'macro', label: 'Macro / sector', value: macro },
        { key: 'news', label: 'News scans', value: news },
      ]
    }
    default:
      return []
  }
}
