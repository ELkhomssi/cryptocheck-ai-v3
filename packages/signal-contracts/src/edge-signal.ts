/**
 * Sentinel Edge — explainable sports edge detection (Prompt A).
 * Consumed by SportsSignalEvaluator → AgentEngine (Prompt B) → on-chain proof (Prompt C).
 * Verdict semantics stay separate from crypto risk (always n/a on match_event).
 */

export type EdgeDetectorId =
  | 'implied_probability'
  | 'latency_edge'
  | 'line_velocity'
  | 'model_divergence'
  | 'anomaly'

/** Per-detector hit — rationale is mandatory for on-chain proof + demo. */
export type EdgeDetectorHit = {
  detector: EdgeDetectorId
  /** Edge size 0–100 (same scale as UnifiedSignal.scoreValue). */
  magnitude: number
  /** 0–1. */
  confidence: number
  /** Human-readable; feeds proof + dashboard. */
  rationale: string
  /** Model / post-event fair decimal odds. */
  fairValue?: number
  /** Observed market decimal odds. */
  marketValue?: number
  /**
   * false for anomaly (surface only — never autonomous action).
   * true for detectors that may feed AgentEngine.
   */
  actionable: boolean
}

/**
 * Combined edge for a match_event UnifiedSignal.
 * scoreValue on the signal = magnitude; confidence overwrites signal.confidence when set.
 */
export type EdgeSignal = {
  magnitude: number
  confidence: number
  rationale: string
  /** Best-effort fair decimal odds (model / post-event). */
  fairValue: number
  /** Observed market decimal odds. */
  marketValue: number
  /** Side the edge favors when interpretable. */
  side?: 'home' | 'away' | 'over' | 'under' | 'back' | 'lay' | 'unknown'
  detectors: EdgeDetectorHit[]
  /** True when only non-actionable (anomaly) hits fired. */
  anomalyOnly: boolean
  evaluatedAt: string
}
