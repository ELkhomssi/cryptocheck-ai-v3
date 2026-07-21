import type { TerminalVerdict } from './types'

/**
 * Rules-based Trade Plan — Entry / Risk / Invalidation / TP / Size.
 * Derives ONLY from scan + optional mark price + portfolio totals.
 * Omit fields when inputs missing — never fabricate prices or predictions.
 */

export type TradePlanRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'

export type CoachTradePlan = {
  entryZone: string | null
  riskLevel: TradePlanRiskLevel | null
  invalidation: string | null
  takeProfitTargets: string[]
  suggestedPositionSize: string | null
  ruleIds: string[]
  /** True when too few inputs to form a plan. */
  insufficient: boolean
}

function riskLevelFrom(verdict: TerminalVerdict | null, riskScore: number | null): TradePlanRiskLevel | null {
  if (verdict === 'BLOCKED') return 'EXTREME'
  if (verdict === 'HIGH_RISK') return 'HIGH'
  if (verdict === 'CAUTION') return 'MEDIUM'
  if (verdict === 'SAFE') {
    if (riskScore != null && riskScore >= 45) return 'MEDIUM'
    return 'LOW'
  }
  if (riskScore == null) return null
  if (riskScore >= 80) return 'EXTREME'
  if (riskScore >= 60) return 'HIGH'
  if (riskScore >= 35) return 'MEDIUM'
  return 'LOW'
}

/** Max portfolio % suggestion from risk band — deterministic, not a prediction. */
function sizePctCap(level: TradePlanRiskLevel | null): number | null {
  if (level === 'EXTREME') return 0
  if (level === 'HIGH') return 1
  if (level === 'MEDIUM') return 3
  if (level === 'LOW') return 5
  return null
}

export function buildCoachTradePlan(input: {
  verdict: TerminalVerdict | null
  riskScore: number | null
  safetyScore: number | null
  /** Mark / last price in USD when known from signal or quote. */
  markPriceUsd: number | null
  /** Optional liquidity USD from feed when present. */
  liquidityUsd: number | null
  /** Optional volatility proxy: abs 24h % move when known. */
  volatilityPct: number | null
  portfolioTotalUsd: number
  /** Current ticket amount in SOL (for context only). */
  ticketAmountSol: number | null
  solPriceUsd: number | null
}): CoachTradePlan {
  const ruleIds: string[] = []
  const riskLevel = riskLevelFrom(input.verdict, input.riskScore)

  if (!input.verdict || input.verdict === 'INSUFFICIENT_DATA') {
    return {
      entryZone: null,
      riskLevel,
      invalidation: null,
      takeProfitTargets: [],
      suggestedPositionSize: null,
      ruleIds: ['need_verdict'],
      insufficient: true,
    }
  }

  if (input.verdict === 'BLOCKED') {
    ruleIds.push('blocked_no_plan')
    return {
      entryZone: 'No entry — blocked',
      riskLevel: 'EXTREME',
      invalidation: 'Engine hard-block active',
      takeProfitTargets: [],
      suggestedPositionSize: '0% of book',
      ruleIds,
      insufficient: false,
    }
  }

  let entryZone: string | null = null
  if (input.markPriceUsd != null && input.markPriceUsd > 0) {
    ruleIds.push('entry_from_mark')
    const band =
      input.volatilityPct != null && input.volatilityPct > 15
        ? 0.04
        : input.volatilityPct != null && input.volatilityPct > 8
          ? 0.025
          : 0.015
    const lo = input.markPriceUsd * (1 - band)
    const hi = input.markPriceUsd * (1 + band * 0.5)
    entryZone = `Near mark $${input.markPriceUsd.toPrecision(4)} (zone $${lo.toPrecision(4)}–$${hi.toPrecision(4)})`
  } else {
    ruleIds.push('entry_qualitative')
    entryZone =
      input.verdict === 'SAFE'
        ? 'Scale in only after fresh scan confirms SAFE'
        : 'Wait for clearer mark + re-scan before entry'
  }

  let invalidation: string | null = null
  if (input.riskScore != null) {
    const abort = Math.min(95, Math.max(input.riskScore + 15, 70))
    ruleIds.push('invalidation_risk_threshold')
    invalidation = `Abort if risk score ≥ ${abort} or verdict becomes BLOCKED/DANGER`
  } else {
    invalidation = 'Abort on BLOCKED / DANGER re-scan'
    ruleIds.push('invalidation_verdict_only')
  }

  if (input.liquidityUsd != null && input.liquidityUsd > 0 && input.liquidityUsd < 25_000) {
    ruleIds.push('thin_liquidity_note')
    invalidation = `${invalidation} · thin liquidity ($${Math.round(input.liquidityUsd).toLocaleString()})`
  }

  const takeProfitTargets: string[] = []
  if (input.markPriceUsd != null && input.markPriceUsd > 0 && riskLevel !== 'EXTREME') {
    // Relative targets from mark — rules bands, not predicted tops.
    const t1 = riskLevel === 'HIGH' ? 0.08 : riskLevel === 'MEDIUM' ? 0.12 : 0.18
    const t2 = riskLevel === 'HIGH' ? 0.15 : riskLevel === 'MEDIUM' ? 0.22 : 0.35
    ruleIds.push('tp_relative_to_mark')
    takeProfitTargets.push(`TP1 +${Math.round(t1 * 100)}% ($${((input.markPriceUsd * (1 + t1))).toPrecision(4)})`)
    takeProfitTargets.push(`TP2 +${Math.round(t2 * 100)}% ($${((input.markPriceUsd * (1 + t2))).toPrecision(4)})`)
  }
  // else: omit TPs — no mark = no fabricated price targets

  let suggestedPositionSize: string | null = null
  const cap = sizePctCap(riskLevel)
  if (cap != null && input.portfolioTotalUsd > 0) {
    ruleIds.push('size_from_portfolio_risk')
    const usd = (input.portfolioTotalUsd * cap) / 100
    if (input.solPriceUsd != null && input.solPriceUsd > 0) {
      const sol = usd / input.solPriceUsd
      suggestedPositionSize = `≤ ${cap}% of book (~$${usd.toFixed(0)} / ~${sol.toFixed(2)} SOL)`
    } else {
      suggestedPositionSize = `≤ ${cap}% of book (~$${usd.toFixed(0)})`
    }
  } else if (cap === 0) {
    suggestedPositionSize = '0% — do not open'
  } else if (cap != null) {
    ruleIds.push('size_pct_only')
    suggestedPositionSize = `≤ ${cap}% of book (connect wallet for $)`
  }

  return {
    entryZone,
    riskLevel,
    invalidation,
    takeProfitTargets,
    suggestedPositionSize,
    ruleIds,
    insufficient: false,
  }
}
