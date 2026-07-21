/**
 * MOCK_ONLY — do not ship as real feed.
 * Sparklines for market ribbon when live series are not yet connected.
 * Swap to a real OHLC/ticker series behind the same MarketStat.sparkline field.
 */

export const MOCK_ONLY = true as const

/** Deterministic pseudo-series from a seed (stable across renders). */
export function mockSparkline(seed: number, points = 24): number[] {
  const out: number[] = []
  let v = 50 + (seed % 17)
  for (let i = 0; i < points; i++) {
    const wobble = ((seed * (i + 3)) % 11) - 5
    v = Math.max(8, Math.min(92, v + wobble * 0.35))
    out.push(Number(v.toFixed(2)))
  }
  return out
}

export function flatBaseline(points = 24, level = 50): number[] {
  return Array.from({ length: points }, () => level)
}
