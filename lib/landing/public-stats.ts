import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { RevenueVerdict, ScanResult } from '@/lib/revenue-dashboard/types'
import type { LandingPublicStats, LandingStat } from '@/lib/landing/types'

export type { LandingPublicStats, LandingStat } from '@/lib/landing/types'

function formatAsOfLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function mapVerdict(raw: string | null | undefined): RevenueVerdict | null {
  if (!raw) return null
  const v = raw.trim().toUpperCase().replace(/\s+/g, '_')
  if (v === 'SAFE' || v === 'LOW_RISK') return 'SAFE'
  if (v === 'CAUTION' || v === 'MODERATE') return 'CAUTION'
  if (
    v === 'DANGER' ||
    v === 'HIGH_RISK' ||
    v === 'CRITICAL' ||
    v === 'CRITICAL_RISK' ||
    v === 'BLOCKED' ||
    v === 'AVOID' ||
    v === 'SCAM'
  ) {
    return 'DANGER'
  }
  return null
}

/** scan_history.risk_score is gateway risk (higher = riskier). Convert to safety for ScanResult. */
function toSafetyScore(riskScore: number | null | undefined): number {
  if (riskScore == null || !Number.isFinite(riskScore)) return 50
  const r = Math.max(0, Math.min(100, Math.round(riskScore)))
  return 100 - r
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

async function countSince(iso: string): Promise<number | null> {
  try {
    const sb = getSupabaseAdmin()
    const { count, error } = await sb
      .from('scan_history')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', iso)
    if (error) return null
    return count ?? 0
  } catch {
    return null
  }
}

async function countTotal(): Promise<number | null> {
  try {
    const sb = getSupabaseAdmin()
    const { count, error } = await sb.from('scan_history').select('id', { count: 'exact', head: true })
    if (error) return null
    return count ?? 0
  } catch {
    return null
  }
}

async function countFlaggedSince(iso: string): Promise<number | null> {
  try {
    const sb = getSupabaseAdmin()
    const { count, error } = await sb
      .from('scan_history')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', iso)
      .in('verdict', ['DANGER', 'HIGH_RISK', 'CRITICAL', 'CRITICAL_RISK', 'BLOCKED', 'AVOID', 'SCAM'])
    if (error) return null
    return count ?? 0
  } catch {
    return null
  }
}

/** Median of recent neural_v4_latency_ms samples from system_metrics, when instrumented. */
async function medianLatencyMs(): Promise<number | null> {
  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('system_metrics')
      .select('metric_value')
      .eq('metric_name', 'neural_v4_latency_ms')
      .order('collected_at', { ascending: false })
      .limit(200)
    if (error || !data?.length) return null
    const vals = data
      .map((r) => Number(r.metric_value))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b)
    if (!vals.length) return null
    const mid = Math.floor(vals.length / 2)
    return vals.length % 2 === 0 ? Math.round((vals[mid - 1]! + vals[mid]!) / 2) : Math.round(vals[mid]!)
  } catch {
    return null
  }
}

async function fetchRecentPresentableScan(): Promise<ScanResult | null> {
  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('scan_history')
      .select('mint_address, risk_score, verdict, created_at')
      .order('created_at', { ascending: false })
      .limit(25)
    if (error || !data?.length) return null

    for (const row of data) {
      const mint = typeof row.mint_address === 'string' ? row.mint_address.trim() : ''
      if (mint.length < 32) continue
      const verdict = mapVerdict(row.verdict)
      if (!verdict) continue
      const risk =
        row.risk_score != null && Number.isFinite(Number(row.risk_score))
          ? Math.max(0, Math.min(100, Math.round(Number(row.risk_score))))
          : verdict === 'SAFE'
            ? 20
            : verdict === 'CAUTION'
              ? 45
              : 75
      const safety = toSafetyScore(risk)
      return {
        mint,
        symbol: mint.slice(0, 4).toUpperCase(),
        name: 'Recent scan',
        safetyScore: safety,
        riskScore: risk,
        verdict,
        confidence: 'medium',
        topSignals: [],
        evidenceLine: 'From scan_history · live product data',
        scannedAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
        cache: 'miss',
        sample: false,
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Public marketing stats — only real DB counts / measured latency.
 * Never fabricates protected-$ or accuracy %.
 */
export async function getLandingPublicStats(): Promise<LandingPublicStats> {
  const now = new Date()
  const asOfIso = now.toISOString()
  const asOfLabel = formatAsOfLabel(now)
  const weekIso = isoDaysAgo(7)

  const [totalScans, scansWeek, flaggedWeek, latencyP50, heroScan] = await Promise.all([
    countTotal(),
    countSince(weekIso),
    countFlaggedSince(weekIso),
    medianLatencyMs(),
    fetchRecentPresentableScan(),
  ])

  const stats: LandingStat[] = []

  if (totalScans != null) {
    stats.push({
      value: formatCount(totalScans),
      label: 'Tokens scanned (all time)',
      note: `as of ${asOfLabel}`,
    })
  }

  if (scansWeek != null) {
    stats.push({
      value: formatCount(scansWeek),
      label: 'Scans last 7 days',
      note: 'last 7 days',
    })
  }

  if (flaggedWeek != null) {
    stats.push({
      value: formatCount(flaggedWeek),
      label: 'Tokens flagged this week',
      note: 'last 7 days · DANGER / high-risk',
    })
  }

  if (latencyP50 != null) {
    stats.push({
      value: `~${latencyP50}ms`,
      label: 'Median scan latency',
      note: 'p50 · system_metrics',
    })
  } else {
    stats.push({
      value: 'Fast',
      label: 'Explainable verdicts',
      note: 'latency not published yet',
    })
  }

  const buildingInPublic =
    (totalScans != null && totalScans < 100) || (scansWeek != null && scansWeek < 20)

  if (buildingInPublic && stats.length > 0) {
    // Honest framing for early / sparse data — keep the real numbers visible.
    stats[0] = {
      ...stats[0]!,
      note: `${stats[0]!.note} · building in public`,
    }
  }

  return { stats, asOfIso, asOfLabel, heroScan, buildingInPublic }
}
