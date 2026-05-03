import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { TIER_DAILY_API_LIMITS } from '@/lib/config/tiers'
import { getUserSubscription } from '@/lib/services/user-subscription.service'
import type { SubscriptionTier } from '@/lib/types/tier'

export type DailyUsagePoint = { date: string; count: number }
export type LatencyBucket = { p50: number; p95: number; avg: number }

/**
 * Aggregates `security_logs` usage lines (`api_usage`, `scan_item`) per UTC day.
 */
export async function getUsageDailySeries(userId: string, days: number): Promise<DailyUsagePoint[]> {
  const sb = getSupabaseAdmin()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const { data, error } = await sb
    .from('security_logs')
    .select('created_at, metadata, action')
    .eq('user_id', userId)
    .in('action', ['api_usage', 'scan_item'])
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })

  if (error || !data) return []

  const byDay = new Map<string, number>()
  for (const row of data) {
    const d = new Date(row.created_at as string)
    const key = d.toISOString().slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }

  return [...byDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
}

export async function getUsageLatencyStats(userId: string, days: number): Promise<LatencyBucket & { sample: number }> {
  const sb = getSupabaseAdmin()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const { data, error } = await sb
    .from('security_logs')
    .select('metadata, action')
    .eq('user_id', userId)
    .in('action', ['api_usage', 'scan_item'])
    .gte('created_at', since.toISOString())

  if (error || !data) return { p50: 0, p95: 0, avg: 0, sample: 0 }

  const latencies: number[] = []
  for (const row of data) {
    const m = row.metadata as Record<string, unknown> | null
    const ms =
      (typeof m?.latency_ms === 'number' ? m.latency_ms : null) ??
      (typeof m?.duration_ms === 'number' ? m.duration_ms : null)
    if (typeof ms === 'number' && Number.isFinite(ms) && ms >= 0) latencies.push(ms)
  }
  if (latencies.length === 0) return { p50: 0, p95: 0, avg: 0, sample: 0 }
  latencies.sort((a, b) => a - b)
  const p50 = latencies[Math.floor(latencies.length * 0.5)]
  const p95 = latencies[Math.floor(latencies.length * 0.95)]
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
  return { p50, p95, avg, sample: latencies.length }
}

function aggregateUsageMetricsFromSecurityRows(
  data: Array<{ created_at: string; metadata: unknown; action: string }>
): {
  series: DailyUsagePoint[]
  latency: LatencyBucket & { sample: number }
  errors: { rate: number; errors: number; total: number }
} {
  const byDay = new Map<string, number>()
  const latencies: number[] = []
  let errors = 0
  const total = data.length

  for (const row of data) {
    const m = row.metadata as Record<string, unknown> | null

    if (row.action === 'api_usage' || row.action === 'scan_item') {
      const d = new Date(row.created_at)
      const key = d.toISOString().slice(0, 10)
      byDay.set(key, (byDay.get(key) ?? 0) + 1)

      const ms =
        (typeof m?.latency_ms === 'number' ? m.latency_ms : null) ??
        (typeof m?.duration_ms === 'number' ? m.duration_ms : null)
      if (typeof ms === 'number' && Number.isFinite(ms) && ms >= 0) latencies.push(ms)
    }

    if (row.action === 'scan_v1_error') {
      errors++
      continue
    }
    if (row.action === 'scan_item' && m?.ok === false) {
      errors++
      continue
    }
    if (row.action === 'api_usage') {
      const sc = m?.status ?? m?.statusCode
      if (typeof sc === 'number' && sc >= 400) errors++
    }
  }

  const series = [...byDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))

  let latency: LatencyBucket & { sample: number }
  if (latencies.length === 0) {
    latency = { p50: 0, p95: 0, avg: 0, sample: 0 }
  } else {
    latencies.sort((a, b) => a - b)
    const p50 = latencies[Math.floor(latencies.length * 0.5)]
    const p95 = latencies[Math.floor(latencies.length * 0.95)]
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
    latency = { p50, p95, avg, sample: latencies.length }
  }

  const rate = total ? errors / total : 0
  return { series, latency, errors: { rate, errors, total } }
}

/** Single `security_logs` read for dashboard usage (series + latency + error rate). */
async function getUsageMetricsFromSecurityLogsUnified(
  userId: string,
  days: number
): Promise<{
  series: DailyUsagePoint[]
  latency: LatencyBucket & { sample: number }
  errors: { rate: number; errors: number; total: number }
}> {
  const sb = getSupabaseAdmin()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const { data, error } = await sb
    .from('security_logs')
    .select('created_at, metadata, action')
    .eq('user_id', userId)
    .in('action', ['api_usage', 'scan_item', 'scan_v1_error'])
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })

  if (error || !data) {
    return {
      series: [],
      latency: { p50: 0, p95: 0, avg: 0, sample: 0 },
      errors: { rate: 0, errors: 0, total: 0 },
    }
  }

  return aggregateUsageMetricsFromSecurityRows(
    data as Array<{ created_at: string; metadata: unknown; action: string }>
  )
}

export async function getUsageErrorRate(userId: string, days: number): Promise<{ rate: number; errors: number; total: number }> {
  const { errors } = await getUsageMetricsFromSecurityLogsUnified(userId, days)
  return errors
}

export async function getQuotaSnapshot(userId: string, tier: SubscriptionTier) {
  const limit = TIER_DAILY_API_LIMITS[tier].maxRequests
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const sb = getSupabaseAdmin()
  const { count, error } = await sb
    .from('security_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('action', ['api_usage', 'scan_item'])
    .gte('created_at', since.toISOString())

  if (error) return { limit, used: 0, remaining: limit }
  const used = count ?? 0
  return { limit, used, remaining: Math.max(0, limit - used) }
}

/** Resolves tier from subscription service + quota math for dashboard. */
export type ScanPipelineLatency = { p50: number; p95: number; p99: number; avg: number; sample: number }

export async function getScanTimingLatencyStats(
  userId: string,
  days: number
): Promise<ScanPipelineLatency | null> {
  const sb = getSupabaseAdmin()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const { data, error } = await sb
    .from('scan_timings')
    .select('total_ms')
    .eq('user_id', userId)
    .eq('cached', false)
    .gte('created_at', since.toISOString())

  if (error || !data?.length) return null
  const ms = data
    .map((r) => Number((r as { total_ms?: unknown }).total_ms))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b)
  if (!ms.length) return null
  const p50 = ms[Math.floor(ms.length * 0.5)]
  const p95 = ms[Math.floor(ms.length * 0.95)]
  const p99 = ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.99))]
  const avg = ms.reduce((a, b) => a + b, 0) / ms.length
  return { p50, p95, p99, avg, sample: ms.length }
}

export async function getDashboardUsageBundle(userId: string, days: number) {
  const sub = await getUserSubscription(userId)
  const tier = sub.runtimeTier
  const [usageBlock, quota, scanPipeline] = await Promise.all([
    getUsageMetricsFromSecurityLogsUnified(userId, days),
    getQuotaSnapshot(userId, tier),
    getScanTimingLatencyStats(userId, days),
  ])
  const { series, latency, errors } = usageBlock
  return { series, latency, errors, quota, tier: sub.effectiveTier, runtimeTier: tier, scanPipeline }
}
