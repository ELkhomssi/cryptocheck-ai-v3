/**
 * Phase 16 — Intelligence Modules contracts.
 * Every displayed number must trace to a real query (see lib/intelligence/*).
 */

export type IntelligenceModuleId =
  | 'market'
  | 'security'
  | 'trading'
  | 'portfolio'
  | 'launch'
  | 'research'

/** Exact state determination — see lib/intelligence/module-state.ts */
export type IntelligenceModuleState =
  | 'running'
  | 'investigating'
  | 'waiting'
  | 'idle'

export type IntelligenceScoreComponents = {
  /** Average of non-Calibrating worker performance scores (0–100). null if none. */
  avgWorkerPerformance: number | null
  /** Provider uptime % over last 24h (0–100). null if insufficient history. */
  providerUptimePct: number | null
  /** 1.0 → 100 when fresh; decays with age vs expected interval. null if unknown. */
  dataFreshnessPct: number | null
}

export type IntelligenceScoreResult = {
  moduleId: IntelligenceModuleId
  /** null when Calibrating — never fabricate a %. */
  score: number | null
  calibrating: boolean
  calibratingReason: string | null
  components: IntelligenceScoreComponents
  computedAt: string
}

export type IntelligenceScoreSnapshot = {
  id: string
  moduleId: IntelligenceModuleId
  score: number | null
  calibrating: boolean
  avgWorkerPerformance: number | null
  providerUptimePct: number | null
  dataFreshnessPct: number | null
  meta: Record<string, unknown> | null
  computedAt: string
}

export type ModuleStat = {
  key: string
  label: string
  /** Numeric value from a real query, or null when unavailable. */
  value: number | null
  /** Optional unit suffix (ms, %, etc.). */
  unit?: string
  /** Honest note when value is null or zero-source. */
  note?: string
}

export type ModuleMemorySlot = {
  label: 'Yesterday' | 'Today' | 'Tomorrow'
  text: string
  /** True when slot is honest idle / no notable entry. */
  idle: boolean
  sourceId?: string | null
  predictionId?: string | null
}

export type ModuleCardView = {
  id: IntelligenceModuleId
  displayName: string
  workerCount: number
  state: IntelligenceModuleState
  investigationTarget: string | null
  score: number | null
  calibrating: boolean
  calibratingReason: string | null
  stats: ModuleStat[]
}

/**
 * Calibrating thresholds (Prompt 16.2 — documented exactly):
 * - At least MIN_NON_CALIBRATING_WORKERS workers with a real (non-calibrating) performance %.
 * - At least MIN_UPTIME_PROBE_COUNT provider probes spanning ≥ MIN_UPTIME_HISTORY_MS.
 * - If EVERY mapped worker is still Calibrating → module shows "Calibrating".
 */
export const INTEL_SCORE_THRESHOLDS = {
  MIN_NON_CALIBRATING_WORKERS: 2,
  MIN_UPTIME_PROBE_COUNT: 6,
  MIN_UPTIME_HISTORY_MS: 24 * 60 * 60 * 1000,
  /** Overall System Health needs this many modules with a real score. */
  MIN_SCORED_MODULES_FOR_OVERALL: 3,
  WEIGHT_WORKER_PERF: 0.5,
  WEIGHT_PROVIDER_UPTIME: 0.3,
  WEIGHT_DATA_FRESHNESS: 0.2,
} as const
