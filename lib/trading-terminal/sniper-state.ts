import {
  SNIPER_DEFAULT_MAX_RISK,
  SNIPER_DEFAULT_MAX_SOL,
  SNIPER_STATE_KEY,
} from './constants'
import type { TerminalVerdict } from './types'

/**
 * Sniper arm state — client intent only.
 * Auto-submit is NOT enabled in V2 stub; arming requires explicit risk summary ack.
 */

export type SniperArmState = {
  armed: boolean
  mint: string
  symbol: string
  maxSol: number
  maxRiskScore: number
  minLiqUsd: number | null
  /** Snapshot of coach verdict at arm time — for UI audit. */
  verdictAtArm: TerminalVerdict | null
  riskScoreAtArm: number | null
  armedAt: string | null
  /** User acknowledged pre-arm risk summary. */
  riskAck: boolean
}

export function defaultSniperState(): SniperArmState {
  return {
    armed: false,
    mint: '',
    symbol: '',
    maxSol: SNIPER_DEFAULT_MAX_SOL,
    maxRiskScore: SNIPER_DEFAULT_MAX_RISK,
    minLiqUsd: null,
    verdictAtArm: null,
    riskScoreAtArm: null,
    armedAt: null,
    riskAck: false,
  }
}

export function parseSniperState(raw: string | null): SniperArmState {
  const base = defaultSniperState()
  if (!raw) return base
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    return {
      armed: Boolean(o.armed),
      mint: typeof o.mint === 'string' ? o.mint : '',
      symbol: typeof o.symbol === 'string' ? o.symbol : '',
      maxSol: typeof o.maxSol === 'number' && o.maxSol > 0 ? o.maxSol : SNIPER_DEFAULT_MAX_SOL,
      maxRiskScore:
        typeof o.maxRiskScore === 'number' ? o.maxRiskScore : SNIPER_DEFAULT_MAX_RISK,
      minLiqUsd: typeof o.minLiqUsd === 'number' ? o.minLiqUsd : null,
      verdictAtArm: typeof o.verdictAtArm === 'string' ? (o.verdictAtArm as TerminalVerdict) : null,
      riskScoreAtArm: typeof o.riskScoreAtArm === 'number' ? o.riskScoreAtArm : null,
      armedAt: typeof o.armedAt === 'string' ? o.armedAt : null,
      riskAck: Boolean(o.riskAck),
    }
  } catch {
    return base
  }
}

export function loadSniperState(): SniperArmState {
  if (typeof window === 'undefined') return defaultSniperState()
  try {
    return parseSniperState(window.localStorage.getItem(SNIPER_STATE_KEY))
  } catch {
    return defaultSniperState()
  }
}

export function saveSniperState(state: SniperArmState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SNIPER_STATE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

/** Hard safety: cannot arm when blocked / risk ≥ max / no ack. */
export function canArmSniper(input: {
  mint: string
  riskScore: number | null
  verdict: TerminalVerdict | null
  maxRiskScore: number
  riskAck: boolean
  maxSol: number
}): { ok: boolean; reason: string | null } {
  if (input.mint.length < 32) return { ok: false, reason: 'Focus a mint first' }
  if (!input.riskAck) return { ok: false, reason: 'Acknowledge pre-arm risk summary' }
  if (!(input.maxSol > 0)) return { ok: false, reason: 'Max SOL must be > 0' }
  if (input.verdict === 'BLOCKED') return { ok: false, reason: 'BLOCKED tokens cannot be sniped' }
  if (input.riskScore != null && input.riskScore >= input.maxRiskScore) {
    return {
      ok: false,
      reason: `Risk ${input.riskScore} ≥ abort threshold ${input.maxRiskScore}`,
    }
  }
  return { ok: true, reason: null }
}
