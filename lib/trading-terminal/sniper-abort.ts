import type { SniperArmState } from './sniper-state'
import type { TerminalVerdict } from './types'

/**
 * Pure abort rules while sniper is armed — used by UI poll + tests.
 */

export type SniperAbortReason =
  | 'disarmed'
  | 'blocked'
  | 'risk_threshold'
  | 'mint_mismatch'
  | 'ok'

export function evaluateSniperAbort(input: {
  state: SniperArmState
  focusMint: string
  riskScore: number | null
  verdict: TerminalVerdict | null
}): { abort: boolean; reason: SniperAbortReason; detail: string } {
  if (!input.state.armed) {
    return { abort: false, reason: 'disarmed', detail: 'Not armed' }
  }
  if (input.state.mint && input.focusMint && input.state.mint !== input.focusMint) {
    return {
      abort: true,
      reason: 'mint_mismatch',
      detail: 'Focus mint changed — disarming armed target.',
    }
  }
  if (input.verdict === 'BLOCKED') {
    return { abort: true, reason: 'blocked', detail: 'Gateway BLOCKED — auto-disarm.' }
  }
  if (
    input.riskScore != null &&
    input.riskScore >= input.state.maxRiskScore
  ) {
    return {
      abort: true,
      reason: 'risk_threshold',
      detail: `Risk ${input.riskScore} ≥ abort threshold ${input.state.maxRiskScore}.`,
    }
  }
  return { abort: false, reason: 'ok', detail: 'Within rails' }
}
