/**
 * Channel trust metrics — shared formulas (ingestion + gate feedback).
 * Keep in sync with gate/channel-metrics-feedback.ts scoring constants.
 */

export type ChannelMetricsRow = {
  signals_seen: number
  signals_safe: number
  signals_caution: number
  signals_danger: number
  signals_dropped: number
  success_rate: number
  latency_ms: number
  latency_samples: number
  trust_score: number
  audience_size?: number | null
  engagement_score?: number | null
  auto_disabled: boolean
  auto_disable_reason?: string | null
}

/** Min resolved token outcomes before auto-disable can fire. */
export const METRICS_MIN_SAMPLES_FOR_DISABLE = Number(
  process.env.SIGNAL_CHANNEL_METRICS_MIN_SAMPLES ?? 8,
)

/** Trust below this → auto_disabled=true and telegram_channels.enabled=false. */
export const METRICS_TRUST_DISABLE_FLOOR = Number(
  process.env.SIGNAL_CHANNEL_TRUST_DISABLE_FLOOR ?? 25,
)

/** Danger rate (danger/resolved) above this → auto-disable. */
export const METRICS_DANGER_RATE_DISABLE = Number(
  process.env.SIGNAL_CHANNEL_DANGER_RATE_DISABLE ?? 0.65,
)

/** Channels below this trust are deprioritized / skipped when list is capped. */
export const METRICS_TRUST_LISTEN_FLOOR = Number(
  process.env.SIGNAL_CHANNEL_TRUST_LISTEN_FLOOR ?? 35,
)

export function computeSuccessRate(safe: number, caution: number, danger: number): number {
  const resolved = safe + caution + danger
  if (resolved <= 0) return 0.5
  return safe / resolved
}

/**
 * trust_score ∈ [0, 100]
 *  - 45% success_rate (safe share of resolved)
 *  - 25% safety (1 - danger_rate)
 *  - 15% latency (faster assess → higher; capped at 8s baseline)
 *  - 15% engagement (optional 0..100)
 */
export function computeTrustScore(input: {
  successRate: number
  dangerRate: number
  latencyMs: number
  engagementScore?: number | null
}): number {
  const success = clamp01(input.successRate)
  const safety = clamp01(1 - clamp01(input.dangerRate))
  const latencyNorm = clamp01(1 - Math.min(input.latencyMs, 8_000) / 8_000)
  const engagement = clamp01((input.engagementScore ?? 50) / 100)

  const raw = 100 * (0.45 * success + 0.25 * safety + 0.15 * latencyNorm + 0.15 * engagement)
  return Math.round(raw * 100) / 100
}

export function dangerRate(safe: number, caution: number, danger: number): number {
  const resolved = safe + caution + danger
  if (resolved <= 0) return 0
  return danger / resolved
}

export function shouldAutoDisable(m: {
  signals_safe: number
  signals_caution: number
  signals_danger: number
  trust_score: number
}): { disable: boolean; reason?: string } {
  const resolved = m.signals_safe + m.signals_caution + m.signals_danger
  if (resolved < METRICS_MIN_SAMPLES_FOR_DISABLE) return { disable: false }

  const dRate = dangerRate(m.signals_safe, m.signals_caution, m.signals_danger)
  if (dRate >= METRICS_DANGER_RATE_DISABLE) {
    return { disable: true, reason: `danger_rate=${dRate.toFixed(2)}>=${METRICS_DANGER_RATE_DISABLE}` }
  }
  if (m.trust_score < METRICS_TRUST_DISABLE_FLOOR) {
    return { disable: true, reason: `trust_score=${m.trust_score}<${METRICS_TRUST_DISABLE_FLOOR}` }
  }
  return { disable: false }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}
