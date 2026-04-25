import type { EvidenceLine, ReasoningObject } from '@/lib/services/scanner-engine'
import type { WeightedSecurityScore } from '@/lib/services/scanner/types'

function sumRiskFor(evidence: EvidenceLine[], categories: EvidenceLine['category'][]): number {
  let t = 0
  for (const e of evidence) {
    if (categories.includes(e.category)) t += e.riskContribution
  }
  return Math.min(100, Math.round(t))
}

/**
 * Derives explainable bucket risks from evidence lines (NOT a black box).
 */
export function buildWeightedSecurityScore(reasoning: ReasoningObject): WeightedSecurityScore {
  const ev = reasoning.evidence

  const liquidity_risk = sumRiskFor(ev, ['liquidity', 'simulation'])
  const wallet_risk = sumRiskFor(ev, ['distribution', 'cluster', 'behavior'])
  const contract_risk = sumRiskFor(ev, ['authority', 'fingerprint'])

  return {
    score: reasoning.aggregateScore,
    confidence: Math.round((reasoning.confidenceScore / 100) * 1000) / 1000,
    risk_breakdown: {
      liquidity_risk,
      wallet_risk,
      contract_risk,
    },
  }
}
