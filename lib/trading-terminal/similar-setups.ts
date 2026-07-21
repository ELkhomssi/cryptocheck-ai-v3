/**
 * Similar setups — historical pattern match gate.
 * Production default: insufficient evidence (no fabricated win rates).
 */

export type SimilarSetupsReady = {
  insufficient: false
  count: number
  avgOutcomePct: number
  winRatePct: number
  avgHoldDays: number
}

export type SimilarSetupsInsufficient = {
  insufficient: true
}

export type SimilarSetups = SimilarSetupsReady | SimilarSetupsInsufficient

export function isSimilarSetupsReady(s: SimilarSetups): s is SimilarSetupsReady {
  return !s.insufficient
}

/** Production-safe default — never invent sample sizes. */
export function loadSimilarSetups(): SimilarSetups {
  // Historical pattern engine not wired — gate hard.
  return { insufficient: true }
}
