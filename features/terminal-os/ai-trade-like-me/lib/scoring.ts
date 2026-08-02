/**
 * Inspectable confidence formula — never an LLM black box.
 * Market vs personalized modes: missing DNA is not scored as bad DNA.
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
 * Personalized confidence — includes behaviorMatch (requires TraderDNA).
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

  const scaled = 35 + raw * 0.65
  return Math.round(Math.max(5, Math.min(97, scaled)))
}

/**
 * Market-quality confidence — excludes behaviorMatch entirely.
 * Used when dna === null (Discovery / untrained wallets).
 * Redistributes behaviorMatch weight into marketQuality + probability.
 */
export function computeMarketConfidence(
  scores: Omit<ConfidenceInputs, 'behaviorMatch'>,
  prefs: UserWeightPrefs = DEFAULT_WEIGHT_PREFS,
): number {
  const bmShare = prefs.behaviorMatch
  const mqW = prefs.marketQuality + bmShare * 0.55
  const probW = prefs.probability + bmShare * 0.25
  const timingW = prefs.timing + bmShare * 0.1
  const execW = prefs.executionQuality + bmShare * 0.1

  const raw =
    scores.marketQuality * mqW +
    scores.probability * probW +
    scores.timing * timingW +
    scores.executionQuality * execW -
    scores.risk * prefs.riskPenalty

  const scaled = 38 + raw * 0.62
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
