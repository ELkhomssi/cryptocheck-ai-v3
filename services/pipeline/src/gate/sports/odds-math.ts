/** Decimal odds / implied probability helpers (no book deps). */

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Decimal odds → raw implied probability (includes overround when multi-way). */
export function impliedProbFromDecimal(decimalOdds: number): number {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return 0
  return 1 / decimalOdds
}

/** Implied probability → decimal odds. */
export function decimalFromImpliedProb(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return NaN
  return 1 / p
}

/**
 * Normalize a set of implied probs so they sum to 1 (remove book overround).
 * Single-outcome: returns the input unchanged (no multi-way book to de-vig).
 */
export function removeOverround(probs: number[]): number[] {
  const sum = probs.reduce((a, b) => a + b, 0)
  if (sum <= 0) return probs.map(() => 0)
  if (probs.length === 1) return [clamp(probs[0]!, 0, 1)]
  return probs.map((p) => p / sum)
}

/** Absolute edge in probability points (fair − market), signed. */
export function probEdge(fairProb: number, marketProb: number): number {
  return fairProb - marketProb
}

/** Map |prob edge| to magnitude 0–100. ~10pp gap → magnitude 50; 20pp → 100. */
export function magnitudeFromProbGap(gapAbs: number): number {
  return clamp(Math.round(gapAbs * 500), 0, 100)
}

/** Format decimal odds for rationales. */
export function fmtOdds(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2)
}

/** Format probability as percent for rationales. */
export function fmtPct(p: number): string {
  if (!Number.isFinite(p)) return '—'
  return `${(p * 100).toFixed(1)}%`
}
