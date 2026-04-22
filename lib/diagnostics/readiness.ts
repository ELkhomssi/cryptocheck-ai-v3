import 'server-only'

export type ReadinessLevel = 'PROTOTYPE' | 'BETA' | 'PRODUCTION' | 'ENTERPRISE'

export function readinessLevelFromScore(score: number | null): ReadinessLevel | 'NOT_DEPLOYED' {
  if (score == null || Number.isNaN(score)) return 'NOT_DEPLOYED'
  if (score < 50) return 'PROTOTYPE'
  if (score < 70) return 'BETA'
  if (score < 90) return 'PRODUCTION'
  return 'ENTERPRISE'
}

/**
 * Weighted readiness (0–100). Missing components: pass `null` for that factor and provide `weightUsed` sum < 1 to renormalize externally, or omit term.
 */
export function computeReadinessScore(parts: {
  availability: number | null
  performance: number | null
  accuracy: number | null
  errorRate: number | null
  uptime: number | null
}): { score: number | null; weightsUsed: number } {
  const w = { a: 0.3, p: 0.2, acc: 0.25, e: 0.15, u: 0.1 }
  let sum = 0
  let wsum = 0
  const add = (val: number | null, weight: number) => {
    if (val == null || Number.isNaN(val)) return
    sum += Math.max(0, Math.min(1, val)) * weight
    wsum += weight
  }
  add(parts.availability, w.a)
  add(parts.performance, w.p)
  add(parts.accuracy, w.acc)
  add(parts.errorRate, w.e)
  add(parts.uptime, w.u)
  if (wsum <= 0) return { score: null, weightsUsed: 0 }
  return { score: (sum / wsum) * 100, weightsUsed: wsum }
}
