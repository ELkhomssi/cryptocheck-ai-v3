/**
 * Prometheus-compatible text exposition helpers (no prom-client dependency).
 * Mount via GET /api/internal/execution/metrics when wired.
 */
import 'server-only'

type CounterKey = string
const counters = new Map<CounterKey, number>()
const histograms = new Map<CounterKey, number[]>()

function key(name: string, labels?: Record<string, string>): string {
  if (!labels || Object.keys(labels).length === 0) return name
  const parts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
  return `${name}{${parts.join(',')}}`
}

export function execMetricInc(name: string, labels?: Record<string, string>, by = 1): void {
  const k = key(name, labels)
  counters.set(k, (counters.get(k) ?? 0) + by)
}

export function execMetricObserve(name: string, value: number, labels?: Record<string, string>): void {
  const k = key(name, labels)
  const arr = histograms.get(k) ?? []
  arr.push(value)
  if (arr.length > 500) arr.shift()
  histograms.set(k, arr)
}

export function renderExecMetricsPrometheus(): string {
  const lines: string[] = [
    '# HELP ccai_exec_preparations_total Execution prepare attempts',
    '# TYPE ccai_exec_preparations_total counter',
  ]
  for (const [k, v] of counters) {
    lines.push(`${k} ${v}`)
  }
  lines.push('# TYPE ccai_exec_latency_ms summary')
  for (const [k, arr] of histograms) {
    if (arr.length === 0) continue
    const sum = arr.reduce((a, b) => a + b, 0)
    const sorted = [...arr].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
    lines.push(`${k}_count ${arr.length}`)
    lines.push(`${k}_sum ${sum}`)
    lines.push(`${k}{quantile="0.5"} ${p50}`)
    lines.push(`${k}{quantile="0.95"} ${p95}`)
  }
  return `${lines.join('\n')}\n`
}

/** Standard metric names for the OMS. */
export const EXEC_METRICS = {
  preparations: 'ccai_exec_preparations_total',
  allowed: 'ccai_exec_allowed_total',
  blockedRisk: 'ccai_exec_blocked_risk_total',
  blockedCapital: 'ccai_exec_blocked_capital_total',
  blockedSim: 'ccai_exec_blocked_simulation_total',
  blockedSafety: 'ccai_exec_blocked_safety_total',
  simFail: 'ccai_exec_simulation_fail_total',
  latencyPrepareMs: 'ccai_exec_prepare_latency_ms',
  slippageBps: 'ccai_exec_slippage_bps',
  fills: 'ccai_exec_fills_total',
  bundleOk: 'ccai_exec_bundle_success_total',
  bundleFail: 'ccai_exec_bundle_fail_total',
} as const
