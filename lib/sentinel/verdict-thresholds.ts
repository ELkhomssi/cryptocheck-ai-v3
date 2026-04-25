import type { CanonicalVerdict } from '@/lib/types/canonical-scan'

/**
 * Canonical verdict thresholds for Sentinel scans.
 *
 * Change thresholds ONLY in this file so all surfaces remain consistent.
 * Score is normalized to 0-100 before mapping.
 */
export function scoreToVerdict(score: number): {
  verdict: CanonicalVerdict
  label: string
} {
  if (score >= 80) return { verdict: 'SAFE', label: 'SAFE' }
  if (score >= 60) return { verdict: 'CAUTION', label: 'CAUTION' }
  if (score >= 40) return { verdict: 'HIGH_RISK', label: 'HIGH RISK' }
  return { verdict: 'AVOID', label: 'AVOID' }
}
