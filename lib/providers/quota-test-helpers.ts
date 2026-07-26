/**
 * Test-only re-exports / pure helpers so node:test can import without Next server-only.
 * Mirrors formulas in lib/providers/quota.ts — keep in sync.
 */

export type ProviderId =
  | 'birdeye'
  | 'jupiter'
  | 'helius'
  | 'coingecko'
  | 'raydium'
  | 'dexscreener'
  | 'anthropic'
  | 'openai'

const DEFAULTS: Record<
  ProviderId,
  { rpm: number; daily: number; softRatio: number; maxDelayMs: number; pauseOn429Ms: number }
> = {
  birdeye: { rpm: 40, daily: 8_000, softRatio: 0.75, maxDelayMs: 2_500, pauseOn429Ms: 30_000 },
  jupiter: { rpm: 120, daily: 50_000, softRatio: 0.8, maxDelayMs: 1_000, pauseOn429Ms: 15_000 },
  helius: { rpm: 300, daily: 100_000, softRatio: 0.85, maxDelayMs: 800, pauseOn429Ms: 20_000 },
  coingecko: { rpm: 25, daily: 9_000, softRatio: 0.7, maxDelayMs: 3_000, pauseOn429Ms: 60_000 },
  raydium: { rpm: 60, daily: 30_000, softRatio: 0.8, maxDelayMs: 1_200, pauseOn429Ms: 20_000 },
  dexscreener: { rpm: 50, daily: 20_000, softRatio: 0.75, maxDelayMs: 2_000, pauseOn429Ms: 45_000 },
  anthropic: { rpm: 30, daily: 2_000, softRatio: 0.8, maxDelayMs: 2_000, pauseOn429Ms: 60_000 },
  openai: { rpm: 60, daily: 10_000, softRatio: 0.8, maxDelayMs: 2_000, pauseOn429Ms: 60_000 },
}

export function getProviderQuotaConfig(provider: ProviderId) {
  return DEFAULTS[provider]
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const n = Math.max(1, size)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n))
  return out
}

export function softDelayForTest(
  used: number,
  limit: number,
  softRatio: number,
  maxDelayMs: number,
): number {
  const softAt = limit * softRatio
  if (used < softAt) return 0
  if (limit <= 0) return maxDelayMs
  const overshoot = (used - softAt) / Math.max(1, limit - softAt)
  return Math.min(maxDelayMs, Math.floor(overshoot * maxDelayMs))
}
