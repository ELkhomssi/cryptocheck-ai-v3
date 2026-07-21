import type { EvidenceBullet, TerminalVerdict } from './types'

/**
 * Deterministic "What AI Coach Would Do" — rules over real evidence only.
 * Not an LLM guess. Not financial advice.
 */

export type CoachAction = {
  interpretation: string
  ruleIds: string[]
}

export function buildCoachAction(input: {
  verdict: TerminalVerdict | null
  riskScore: number | null
  why: EvidenceBullet[]
  risks: EvidenceBullet[]
}): CoachAction | null {
  if (!input.verdict) return null

  const ruleIds: string[] = []
  const parts: string[] = []

  if (input.verdict === 'BLOCKED') {
    ruleIds.push('blocked_hard')
    parts.push('Do not trade — hard block from risk engine.')
  } else if (input.verdict === 'INSUFFICIENT_DATA') {
    ruleIds.push('insufficient_evidence')
    parts.push('Wait for confirmation — evidence coverage too thin.')
  } else if (input.verdict === 'HIGH_RISK') {
    ruleIds.push('high_risk_avoid')
    parts.push('Avoid until concentration / risk signals improve.')
  } else if (input.verdict === 'CAUTION') {
    ruleIds.push('caution_monitor')
    parts.push('Monitor liquidity and holder signals before sizing up.')
  } else if (input.verdict === 'SAFE') {
    if (input.riskScore != null && input.riskScore >= 40) {
      ruleIds.push('safe_elevated_risk')
      parts.push('Risk acceptable for a small position only.')
    } else {
      ruleIds.push('safe_small_ok')
      parts.push('Risk acceptable for small position — size carefully.')
    }
  }

  if (input.risks.length >= 2) {
    ruleIds.push('multi_risk_bullets')
    parts.push('Multiple risk bullets present — reduce size or wait.')
  } else if (input.why.length >= 2 && input.risks.length === 0) {
    ruleIds.push('multi_positive')
    parts.push('Supporting evidence present — still DYOR.')
  }

  if (!parts.length) return null
  return { interpretation: parts.join(' '), ruleIds }
}
