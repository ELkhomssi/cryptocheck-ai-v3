import type { Verdict } from '@cryptocheck/types'

export type DecisionEngineView = {
  /** UI status chip: SAFE / CAUTION / DANGER */
  statusChip: 'SAFE' | 'CAUTION' | 'DANGER'
  /** Human risk tier aligned to verdict */
  riskTier: 'Low Risk' | 'Moderate Risk' | 'High Risk'
  /** Capital allocation label */
  decisionLabel: string
}

/**
 * Maps model verdict → institutional decision language (score is shown separately).
 */
export function mapVerdictToDecision(verdict: Verdict): DecisionEngineView {
  if (verdict === 'SAFE') {
    return { statusChip: 'SAFE', riskTier: 'Low Risk', decisionLabel: 'Low Risk Asset' }
  }
  if (verdict === 'CAUTION') {
    return { statusChip: 'CAUTION', riskTier: 'Moderate Risk', decisionLabel: 'Moderate Risk Asset' }
  }
  return { statusChip: 'DANGER', riskTier: 'High Risk', decisionLabel: 'High Risk Asset' }
}
