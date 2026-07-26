/**
 * Phase 17.4 — pure grounding helpers (no I/O).
 * Separated so unit tests can import without server-only.
 */

import {
  NO_DIFF_EXPLANATION,
  type MetricDiffPoint,
  type RecommendationGrounding,
} from '@/types/intelligence-core'

function hasUsableDiff(before: MetricDiffPoint | null, after: MetricDiffPoint | null): boolean {
  if (!before || !after) return false
  const keys: (keyof MetricDiffPoint)[] = [
    'mintAuthorityActive',
    'freezeAuthorityActive',
    'holderConcentrationPct',
    'liquidityUsd',
    'riskScore',
  ]
  return keys.some((k) => before[k] !== after[k] && (before[k] != null || after[k] != null))
}

function fmtBool(v: boolean | null): string {
  if (v === true) return 'active'
  if (v === false) return 'renounced'
  return 'unknown'
}

function fmtNum(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function describeDiff(before: MetricDiffPoint, after: MetricDiffPoint): string {
  const parts: string[] = []
  if (before.mintAuthorityActive !== after.mintAuthorityActive) {
    parts.push(
      `mint authority ${fmtBool(before.mintAuthorityActive)} → ${fmtBool(after.mintAuthorityActive)}`,
    )
  }
  if (before.freezeAuthorityActive !== after.freezeAuthorityActive) {
    parts.push(
      `freeze authority ${fmtBool(before.freezeAuthorityActive)} → ${fmtBool(after.freezeAuthorityActive)}`,
    )
  }
  if (
    before.holderConcentrationPct !== after.holderConcentrationPct &&
    (before.holderConcentrationPct != null || after.holderConcentrationPct != null)
  ) {
    parts.push(
      `holder concentration ${fmtNum(before.holderConcentrationPct)}% → ${fmtNum(after.holderConcentrationPct)}%`,
    )
  }
  if (
    before.liquidityUsd !== after.liquidityUsd &&
    (before.liquidityUsd != null || after.liquidityUsd != null)
  ) {
    parts.push(`liquidity $${fmtNum(before.liquidityUsd)} → $${fmtNum(after.liquidityUsd)}`)
  }
  if (before.riskScore !== after.riskScore && (before.riskScore != null || after.riskScore != null)) {
    parts.push(`underlying risk ${fmtNum(before.riskScore)} → ${fmtNum(after.riskScore)}`)
  }
  return parts.join('; ')
}

/**
 * Pure grounding step — used by tests and the generate path.
 * MUST NOT invent causes when diff data is missing.
 */
export function explainFromGrounding(grounding: RecommendationGrounding): {
  explanation: string
  grounded: boolean
} {
  if (!hasUsableDiff(grounding.before, grounding.after)) {
    return { explanation: NO_DIFF_EXPLANATION, grounded: false }
  }
  const detail = describeDiff(grounding.before!, grounding.after!)
  const scoreBit =
    grounding.scoreBefore != null && grounding.scoreAfter != null
      ? ` Composite ${grounding.metric} ${grounding.scoreBefore} → ${grounding.scoreAfter}.`
      : ''
  return {
    explanation: `${grounding.metric} moved because ${detail}.${scoreBit}`.trim(),
    grounded: true,
  }
}
