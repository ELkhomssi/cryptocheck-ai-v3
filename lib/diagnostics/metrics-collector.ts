import 'server-only'

import { rpcCall, heliusRest } from '@/lib/helius-server'
import type { TokenMeta } from '@/lib/helius'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { computeWalletPortfolioValuation } from '@/lib/trading-os/portfolio-valuation'
import { computeReadinessScore, readinessLevelFromScore } from '@/lib/diagnostics/readiness'
import type { DiagnosticWarning, HealthStatus, SystemHealthPayload } from '@/lib/diagnostics/types'

const WSOL = 'So11111111111111111111111111111111111111112'

function isoUtcStartOfToday(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function isoSinceHours(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString()
}

async function measureMs(fn: () => Promise<unknown>): Promise<{ ok: boolean; ms: number | null }> {
  const t0 = Date.now()
  try {
    await fn()
    return { ok: true, ms: Date.now() - t0 }
  } catch {
    return { ok: false, ms: Date.now() - t0 }
  }
}

async function countScanHistorySince(iso: string): Promise<number | null> {
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

/** Last N numeric samples for percentile (newest first). */
async function loadMetricSeries(metricName: string, limit: number): Promise<number[]> {
  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('system_metrics')
      .select('metric_value')
      .eq('metric_name', metricName)
      .order('collected_at', { ascending: false })
      .limit(limit)
    if (error || !data?.length) return []
    return data.map((r) => Number(r.metric_value)).filter((n) => Number.isFinite(n))
  } catch {
    return []
  }
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null
  const n = sorted.length
  const pos = ((n - 1) * p) / 100
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo] ?? null
  const w = pos - lo
  const a = sorted[lo] ?? 0
  const b = sorted[hi] ?? a
  return a * (1 - w) + b * w
}

export async function collectNeuralScannerMetrics(
  _errors: SystemHealthPayload['collection_errors'],
  warnings: DiagnosticWarning[]
): Promise<Record<string, unknown>> {
  const neuralLatencySeries = await loadMetricSeries('neural_v4_latency_ms', 200)
  const sorted = [...neuralLatencySeries].sort((a, b) => a - b)
  const p95 = sorted.length ? percentile(sorted, 95) : null
  const p99 = sorted.length ? percentile(sorted, 99) : null

  const stackProbe = await measureMs(async () => {
    await rpcCall<number>('getSlot', [])
    await heliusRest<TokenMeta[]>('/token-metadata', { mintAccounts: [WSOL] })
  })

  const scansToday = await countScanHistorySince(isoUtcStartOfToday())

  let status: HealthStatus = 'UNAVAILABLE'
  if (stackProbe.ok) {
    status = stackProbe.ms != null && stackProbe.ms > 8000 ? 'DEGRADED' : 'ONLINE'
  } else {
    status = 'OFFLINE'
    warnings.push({
      severity: 'CRITICAL',
      message: 'Neural stack probe (RPC + Helius metadata) failed.',
      at: new Date().toISOString(),
    })
  }

  const heliusProbe = await measureMs(async () => {
    await rpcCall<number>('getSlot', [])
  })

  return {
    status,
    metrics: {
      response_time_p95_ms: p95,
      response_time_p99_ms: p99,
      stack_probe_ms: stackProbe.ms,
      stack_probe_ok: stackProbe.ok,
      scans_today: scansToday,
      accuracy_claimed_pct: null,
      accuracy_tracked_pct: null,
      false_positive_rate_24h_pct: null,
      helius_rpc_latency_ms: heliusProbe.ok ? heliusProbe.ms : null,
      helius_rpc_ok: heliusProbe.ok,
      rate_limit_remaining: null,
      note:
        'p95/p99 require `system_metrics` rows (`neural_v4_latency_ms`). Accuracy/false-positive need labeled outcomes (not stored). Helius quota is not exposed via API here.',
    },
  }
}

export async function collectPortfolioMetrics(
  errors: SystemHealthPayload['collection_errors'],
  warnings: DiagnosticWarning[]
): Promise<Record<string, unknown>> {
  const series = await loadMetricSeries('portfolio_api_latency_ms', 100)
  const sorted = [...series].sort((a, b) => a - b)
  const avg =
    series.length > 0 ? series.reduce((a, b) => a + b, 0) / series.length : null
  const p95 = sorted.length ? percentile(sorted, 95) : null

  const probeWallet =
    process.env.DIAGNOSTICS_PROBE_WALLET?.trim() || '5jbWsijUWqXLyuaNtzkiu2JM1C5jNPUP9oRjKmmJx15i'

  const live = await measureMs(async () => {
    await computeWalletPortfolioValuation(probeWallet)
  })

  let dexOk = false
  let dexMs: number | null = null
  const dexT = await measureMs(async () => {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(WSOL)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'CryptoCheckDiagnostics/1.0' },
    })
    dexOk = r.ok
    if (!r.ok) throw new Error(String(r.status))
  })
  dexMs = dexT.ok ? dexT.ms : null
  if (!dexT.ok) dexOk = false

  let status: HealthStatus = 'ONLINE'
  if (!live.ok) {
    status = 'OFFLINE'
    warnings.push({ severity: 'CRITICAL', message: 'Portfolio valuation probe failed.', at: new Date().toISOString() })
  } else if (live.ms != null && live.ms > 5000) {
    status = 'DEGRADED'
    warnings.push({
      severity: 'WARNING',
      message: `Portfolio probe latency ${live.ms}ms (target: stable RPC).`,
      at: new Date().toISOString(),
    })
  }

  if (avg != null && avg > 500) {
    warnings.push({
      severity: 'WARNING',
      message: 'Portfolio API rolling average >500ms from `system_metrics.portfolio_api_latency_ms` (if populated).',
      at: new Date().toISOString(),
    })
  }

  return {
    status,
    metrics: {
      avg_response_time_ms_from_series: avg,
      response_time_p95_ms_from_series: p95,
      last_probe_latency_ms: live.ms,
      last_probe_ok: live.ok,
      probe_wallet: probeWallet,
      dexscreener_ok: dexOk,
      dexscreener_latency_ms: dexMs,
      rpc_success_rate_pct: live.ok ? 100 : 0,
      cache_hit_ratio: null,
      note: 'Success rate / p95 from metrics table requires instrumentation writing `portfolio_api_latency_ms` + status.',
    },
  }
}

export async function collectWebSocketMetrics(): Promise<Record<string, unknown>> {
  const wsUrl = process.env.NEXT_PUBLIC_TRADING_WS_URL?.trim()
  if (!wsUrl) {
    return {
      status: 'NOT_DEPLOYED' as HealthStatus,
      metrics: {
        active_connections: 0,
        messages_per_second: null,
        avg_latency_ms: null,
        reconnection_rate_pct: null,
        memory_mb_per_connection: null,
        uptime_pct_24h: null,
      },
    }
  }
  return {
    status: 'UNAVAILABLE' as HealthStatus,
    metrics: {
      active_connections: null,
      messages_per_second: null,
      avg_latency_ms: null,
      reconnection_rate_pct: null,
      memory_mb_per_connection: null,
      uptime_pct_24h: null,
      note: 'WS URL set but no global connection registry in this deployment.',
    },
  }
}

export async function collectAlertEngineMetrics(
  errors: SystemHealthPayload['collection_errors']
): Promise<Record<string, unknown>> {
  let lpDetectorStatus: HealthStatus = 'ONLINE'
  try {
    await import('@/services/alerts/lp-rug-detector')
    void (await import('@/modules/copilot/enhanced-rug-detector'))
  } catch (e) {
    lpDetectorStatus = 'OFFLINE'
    errors.push({
      source: 'alert_engine.import',
      message: e instanceof Error ? e.message : String(e),
      at: new Date().toISOString(),
    })
  }

  const since24 = isoSinceHours(24)
  const since1h = isoSinceHours(1)

  let critical24: number | null = null
  let high24: number | null = null
  let events1h: number | null = null
  try {
    const sb = getSupabaseAdmin()
    const cCrit = await sb
      .from('trading_os_alerts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24)
      .eq('kind', 'lp_rug_critical')
    if (cCrit.error) {
      errors.push({ source: 'trading_os_alerts.critical', message: cCrit.error.message, at: new Date().toISOString() })
    } else {
      critical24 = cCrit.count ?? 0
    }

    const cHigh = await sb
      .from('trading_os_alerts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24)
      .eq('kind', 'lp_rug_high_risk')
    if (cHigh.error) {
      errors.push({ source: 'trading_os_alerts.high_risk', message: cHigh.error.message, at: new Date().toISOString() })
    } else {
      high24 = cHigh.count ?? 0
    }

    const c1 = await sb.from('trading_os_alerts').select('id', { count: 'exact', head: true }).gte('created_at', since1h)
    if (c1.error) {
      errors.push({ source: 'trading_os_alerts.hourly', message: c1.error.message, at: new Date().toISOString() })
    } else {
      events1h = c1.count ?? 0
    }
  } catch (e) {
    errors.push({
      source: 'trading_os_alerts.count',
      message: e instanceof Error ? e.message : String(e),
      at: new Date().toISOString(),
    })
  }

  let telegramSent = 0
  let telegramFailed = 0
  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('alert_history')
      .select('delivery_status')
      .eq('delivery_channel', 'telegram')
      .gte('delivered_at', since24)
    if (!error && data) {
      for (const row of data) {
        if (row.delivery_status === 'sent') telegramSent++
        else if (row.delivery_status === 'failed') telegramFailed++
      }
    }
  } catch (e) {
    errors.push({
      source: 'alert_history.telegram',
      message: e instanceof Error ? e.message : String(e),
      at: new Date().toISOString(),
    })
  }

  const tgTotal = telegramSent + telegramFailed
  const telegramSuccessPct = tgTotal > 0 ? (telegramSent / tgTotal) * 100 : null

  return {
    status: lpDetectorStatus,
    metrics: {
      lp_rug_detector: lpDetectorStatus,
      events_processed_last_hour: events1h,
      critical_alerts_24h: critical24,
      high_risk_alerts_24h: high24,
      false_positive_rate_by_severity: null,
      avg_detection_time_ms: null,
      telegram_success_rate_pct_24h: telegramSuccessPct,
      note: 'False positive / detection latency require labeled pipeline (not persisted yet).',
    },
  }
}

export async function collectDatabaseMetrics(errors: SystemHealthPayload['collection_errors']): Promise<Record<string, unknown>> {
  const tables = ['trading_os_portfolios', 'trading_os_alerts', 'trading_os_tracked_wallets'] as const
  const rowCounts: Record<string, number | null> = {}
  try {
    const sb = getSupabaseAdmin()
    for (const t of tables) {
      const { count, error } = await sb.from(t).select('id', { count: 'exact', head: true })
      if (error) {
        rowCounts[t] = null
        errors.push({
          source: `database.count.${t}`,
          message: error.message,
          at: new Date().toISOString(),
        })
      } else {
        rowCounts[t] = count ?? 0
      }
    }
  } catch (e) {
    errors.push({
      source: 'database.row_counts',
      message: e instanceof Error ? e.message : String(e),
      at: new Date().toISOString(),
    })
  }

  return {
    status: 'ONLINE' as HealthStatus,
    metrics: {
      connection_pool_usage_pct: null,
      slow_queries_over_100ms: null,
      table_row_counts: rowCounts,
      index_hit_ratio: null,
      replication_lag_ms: null,
      note: 'Pool/pg_stat_statements/replication are not exposed to the app role; use Supabase dashboard.',
    },
  }
}

function scoreFromCategory(
  status: HealthStatus,
  extras: { latencyMs?: number | null; probeOk?: boolean }
): { availability: number | null; performance: number | null; accuracy: number | null; errorRate: number | null; uptime: number | null } {
  if (status === 'NOT_DEPLOYED') {
    return { availability: null, performance: null, accuracy: null, errorRate: null, uptime: null }
  }
  if (status === 'OFFLINE') {
    return { availability: 0, performance: 0, accuracy: null, errorRate: 0, uptime: 0 }
  }
  if (status === 'UNAVAILABLE') {
    return { availability: 0.5, performance: 0.45, accuracy: null, errorRate: 0.55, uptime: 0.5 }
  }
  const availability = status === 'ONLINE' ? 1 : 0.65
  const lat = extras.latencyMs
  const performance =
    lat == null ? 0.7 : lat < 500 ? 1 : lat < 2000 ? 0.75 : lat < 8000 ? 0.5 : 0.35
  const errorRate = extras.probeOk === false ? 0.2 : 0.95
  return { availability, performance, accuracy: null, errorRate, uptime: availability }
}

export async function collectSystemDiagnostics(): Promise<SystemHealthPayload> {
  const timestamp = new Date().toISOString()
  const collection_errors: SystemHealthPayload['collection_errors'] = []
  const alerts: DiagnosticWarning[] = []

  const neural = await collectNeuralScannerMetrics(collection_errors, alerts)
  const portfolio = await collectPortfolioMetrics(collection_errors, alerts)
  const websocket = await collectWebSocketMetrics()
  const alertEngine = await collectAlertEngineMetrics(collection_errors)
  const database = await collectDatabaseMetrics(collection_errors)

  const neuralStatus = neural.status as HealthStatus
  const stackMs = (neural.metrics as { stack_probe_ms?: number | null }).stack_probe_ms ?? null
  const neuralScore = computeReadinessScore(
    scoreFromCategory(neuralStatus, { latencyMs: stackMs, probeOk: (neural.metrics as { stack_probe_ok?: boolean }).stack_probe_ok })
  )

  const portStatus = portfolio.status as HealthStatus
  const probeMs = (portfolio.metrics as { last_probe_latency_ms?: number | null }).last_probe_latency_ms ?? null
  const probeOk = !!(portfolio.metrics as { last_probe_ok?: boolean }).last_probe_ok
  const portfolioScore = computeReadinessScore(scoreFromCategory(portStatus, { latencyMs: probeMs, probeOk }))

  const wsStatus = websocket.status as HealthStatus
  const wsScore =
    wsStatus === 'NOT_DEPLOYED'
      ? { score: null as number | null, weightsUsed: 0 }
      : computeReadinessScore({ availability: 0.4, performance: 0.4, accuracy: null, errorRate: 0.5, uptime: 0.4 })

  const alertStatus = alertEngine.status as HealthStatus
  const alertScore = computeReadinessScore(scoreFromCategory(alertStatus, { latencyMs: null, probeOk: true }))

  const dbStatus = database.status as HealthStatus
  const dbScore = computeReadinessScore(scoreFromCategory(dbStatus, { latencyMs: null, probeOk: true }))

  const copyTradingScore = { score: null as number | null, weightsUsed: 0 }
  const pnlScore = { score: null as number | null, weightsUsed: 0 }

  const scores = [
    neuralScore.score,
    portfolioScore.score,
    wsScore.score,
    alertScore.score,
    dbScore.score,
  ].filter((s): s is number => s != null && !Number.isNaN(s))
  const overall_readiness = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null

  const readiness_by_feature = {
    neural_scanner_v4: { score: neuralScore.score, level: readinessLevelFromScore(neuralScore.score) },
    portfolio_api: { score: portfolioScore.score, level: readinessLevelFromScore(portfolioScore.score) },
    realtime_pnl: { score: pnlScore.score, level: readinessLevelFromScore(pnlScore.score) },
    copy_trading: { score: copyTradingScore.score, level: readinessLevelFromScore(copyTradingScore.score) },
    alert_engine: { score: alertScore.score, level: readinessLevelFromScore(alertScore.score) },
    websocket_service: { score: wsScore.score, level: readinessLevelFromScore(wsScore.score) },
  }

  return {
    timestamp,
    overall_readiness,
    categories: {
      neural_scanner: { ...neural, readiness: neuralScore.score },
      portfolio_engine: { ...portfolio, readiness: portfolioScore.score },
      websocket_service: { ...websocket, readiness: wsScore.score },
      alert_engine: { ...alertEngine, readiness: alertScore.score },
      database,
      system_readiness: {
        levels: readiness_by_feature,
        formula: 'weighted blend: availability 0.3, performance 0.2, accuracy 0.25, error_rate 0.15, uptime 0.1 (missing terms reweighted)',
      },
    },
    readiness_by_feature,
    alerts,
    collection_errors,
  }
}
