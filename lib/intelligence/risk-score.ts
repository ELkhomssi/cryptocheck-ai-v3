/**
 * Deterministic rug / safety score (0–100) and verdict from auditable inputs.
 * Start at 50 (neutral), apply signals, clamp to [0, 100].
 */

import type { InsiderFlagRow, RiskSignal, RiskVerdict } from '@/lib/types/intelligence'

export type RiskScoreInputs = {
  mintAuthorityRenounced: boolean
  freezeAuthorityRenounced: boolean
  /** null = not applicable (e.g. fungible without metadata update auth) */
  updateAuthorityRenounced: boolean | null
  /** 0–100; null if unknown */
  lpBurnedPct: number | null
  /** If lock end is known and in the future */
  lockedLongTerm: boolean
  top10Concentration: number | null
  liquidityUsd: number | null
  pairAgeDays: number | null
  insiderFlags: InsiderFlagRow[] | null
}

export type RiskScoreResult = {
  score: number
  verdict: RiskVerdict
  signals: RiskSignal[]
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function verdictForScore(score: number): RiskVerdict {
  if (score >= 80) return 'SAFE'
  if (score >= 60) return 'CAUTION'
  if (score >= 40) return 'RISKY'
  return 'DANGER'
}

/**
 * Computes risk score from neutral 50 and ordered signal list.
 */
export function computeRiskScoreAndSignals(input: RiskScoreInputs): RiskScoreResult {
  const signals: RiskSignal[] = []
  let score = 50

  const push = (s: RiskSignal) => {
    signals.push(s)
    score += s.impact
  }

  if (input.mintAuthorityRenounced) {
    push({
      code: 'MINT_AUTH_REVOKED',
      severity: 'info',
      message: 'Mint authority renounced — supply cannot be inflated by deployer.',
      impact: 20,
    })
  }

  if (input.freezeAuthorityRenounced) {
    push({
      code: 'FREEZE_AUTH_REVOKED',
      severity: 'info',
      message: 'Freeze authority renounced.',
      impact: 15,
    })
  }

  if (input.updateAuthorityRenounced === true) {
    push({
      code: 'UPDATE_AUTH_REVOKED',
      severity: 'info',
      message: 'Metadata update authority renounced.',
      impact: 10,
    })
  }

  const burned = input.lpBurnedPct
  const lpBonus =
    burned != null && burned >= 95
      ? 25
      : input.lockedLongTerm
        ? 25
        : 0
  if (lpBonus > 0) {
    push({
      code: input.lockedLongTerm && (burned == null || burned < 95) ? 'LP_LOCKED_LONG' : 'LP_BURNED_HIGH',
      severity: 'info',
      message:
        input.lockedLongTerm && (burned == null || burned < 95)
          ? 'Liquidity locked beyond 90 days (best-effort).'
          : 'LP burn ≥ 95% (best-effort).',
      impact: lpBonus,
    })
  }

  const t10 = input.top10Concentration
  if (t10 != null) {
    if (t10 < 30) {
      push({
        code: 'TOP10_DISTRIBUTED',
        severity: 'info',
        message: `Top-10 holders ~${t10.toFixed(1)}% — relatively distributed.`,
        impact: 15,
      })
    } else if (t10 > 70) {
      push({
        code: 'TOP10_CONCENTRATED',
        severity: 'danger',
        message: `Top-10 concentration ~${t10.toFixed(1)}% — extreme holder risk.`,
        impact: -20,
      })
    }
  }

  const liq = input.liquidityUsd
  if (liq != null) {
    if (liq > 50_000) {
      push({
        code: 'LIQ_DEEP',
        severity: 'info',
        message: `Liquidity ~$${Math.round(liq).toLocaleString()} — above $50k threshold.`,
        impact: 10,
      })
    } else if (liq < 5_000) {
      push({
        code: 'LIQ_THIN',
        severity: 'warn',
        message: `Liquidity ~$${Math.round(liq).toLocaleString()} — below $5k threshold.`,
        impact: -15,
      })
    }
  }

  const age = input.pairAgeDays
  if (age != null) {
    if (age > 7) {
      push({
        code: 'PAIR_AGED',
        severity: 'info',
        message: `Pair age ~${age.toFixed(1)}d — older than 7 days.`,
        impact: 10,
      })
    } else if (age < 1) {
      push({
        code: 'PAIR_NEW',
        severity: 'warn',
        message: 'Pair younger than 24 hours — very new.',
        impact: -10,
      })
    }
  }

  const highInsider = (input.insiderFlags ?? []).some((f) => f.severity === 'high')
  if (highInsider) {
    push({
      code: 'INSIDER_HIGH',
      severity: 'danger',
      message: 'At least one high-severity insider heuristic flag.',
      impact: -10,
    })
  }

  score = Math.round(clamp(score, 0, 100))
  return {
    score,
    verdict: verdictForScore(score),
    signals,
  }
}
