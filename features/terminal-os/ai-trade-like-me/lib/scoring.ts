/**
 * Inspectable confidence formula — never an LLM black box.
 * Weights are user-adjustable via UserWeightPrefs.
 */

import type { UserWeightPrefs } from '../types'
import { DEFAULT_WEIGHT_PREFS } from '../types'

export type ConfidenceInputs = {
  behaviorMatch: number
  marketQuality: number
  probability: number
  timing: number
  executionQuality: number
  risk: number
}

/**
 * computeConfidence — explicit weighted combination.
 * riskPenalty subtracts normalized risk from the blend.
 */
export function computeConfidence(
  scores: ConfidenceInputs,
  prefs: UserWeightPrefs = DEFAULT_WEIGHT_PREFS,
): number {
  const raw =
    scores.behaviorMatch * prefs.behaviorMatch +
    scores.marketQuality * prefs.marketQuality +
    scores.probability * prefs.probability +
    scores.timing * prefs.timing +
    scores.executionQuality * prefs.executionQuality -
    scores.risk * prefs.riskPenalty

  // Re-normalize so typical good setups land ~60–95
  const scaled = 35 + raw * 0.65
  return Math.round(Math.max(5, Math.min(97, scaled)))
}

/** Cosine similarity of two sparse numeric vectors (0–100 scale result). */
export function cosineSimilarity(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  let dot = 0
  let na = 0
  let nb = 0
  for (const k of keys) {
    const av = a[k] ?? 0
    const bv = b[k] ?? 0
    dot += av * bv
    na += av * av
    nb += bv * bv
  }
  if (na === 0 || nb === 0) return 0
  return Math.round((dot / (Math.sqrt(na) * Math.sqrt(nb))) * 100)
}
