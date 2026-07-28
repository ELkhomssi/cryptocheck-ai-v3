import type { ScoreBand } from '../types'

export function scoreToBand(score: number): ScoreBand {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'caution'
  return 'danger'
}
