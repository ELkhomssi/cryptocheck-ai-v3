/**
 * PROMPT 15 — Causal Attribution Engine
 *
 * Explains *why* an opportunity scores the way it does as model share %.
 * Shares are estimates (weights × factor strength), not ground truth.
 * Thin inputs → null / insufficient — never invent a confident story.
 */

import {
  OPPORTUNITY_WEIGHTS,
  type OpportunityMeasuredInputs,
} from './opportunity-engine'

export type AttributionFactor =
  | 'smart_money'
  | 'liquidity'
  | 'holders'
  | 'insider_quiet'
  | 'pool_age'

export type AttributionShare = {
  factor: AttributionFactor
  label: string
  /** Model share of positive conviction drivers; sum of contributing ≈ 100. */
  sharePct: number
  direction: 'up' | 'risk' | 'neutral'
  evidence: string
  sourceField: keyof OpportunityMeasuredInputs
}

export type CausalAttribution = {
  mint: string
  symbol: string
  shares: AttributionShare[]
  /** Sum of sharePct for up-direction factors (should be ~100 when any). */
  explainedPct: number
  confidencePct: number
  method: 'causal-attribution-v1'
  /** Always shown — percentages are model estimates. */
  disclaimer: string
}

const DISCLAIMER = 'Model estimate — not ground-truth causation'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function smStrength(usd: number): number {
  return clamp(Math.abs(usd) / 200_000, 0, 1)
}

function lpStrength(pct: number): number {
  return clamp(Math.abs(pct) / 40, 0, 1)
}

function holderStrength(pct: number): number {
  return clamp(Math.abs(pct) / 25, 0, 1)
}

function insiderStrength(active: boolean): number {
  // Quiet (inactive) is the positive driver; active is risk drag
  return active ? 0.85 : 0.55
}

function poolAgeStrength(hours: number | null): number {
  if (hours == null) return 0
  if (hours < 48) return 0.9
  if (hours < 168) return 0.55
  return 0.25
}

/**
 * Attribute conviction drivers for measured inputs.
 * Returns null when evidence is too thin to explain.
 */
export function attributeOpportunity(
  input: OpportunityMeasuredInputs,
): CausalAttribution | null {
  const hasSignal =
    Math.abs(input.smartMoneyNetInflowUsd) >= 15_000 ||
    Math.abs(input.liquidityExpansionPct) >= 8 ||
    Math.abs(input.holderGrowthPct) >= 8

  if (!hasSignal) return null

  type Raw = {
    factor: AttributionFactor
    label: string
    weight: number
    strength: number
    direction: 'up' | 'risk' | 'neutral'
    evidence: string
    sourceField: keyof OpportunityMeasuredInputs
    present: boolean
  }

  const raw: Raw[] = [
    {
      factor: 'smart_money',
      label: 'Smart money flow',
      weight: OPPORTUNITY_WEIGHTS.smartMoney,
      strength: smStrength(input.smartMoneyNetInflowUsd),
      direction:
        input.smartMoneyNetInflowUsd >= 15_000
          ? 'up'
          : input.smartMoneyNetInflowUsd <= -15_000
            ? 'risk'
            : 'neutral',
      evidence:
        input.smartMoneyNetInflowUsd >= 0
          ? `+$${Math.round(input.smartMoneyNetInflowUsd / 1000)}k net inflow`
          : `−$${Math.round(Math.abs(input.smartMoneyNetInflowUsd) / 1000)}k net outflow`,
      sourceField: 'smartMoneyNetInflowUsd',
      present: Number.isFinite(input.smartMoneyNetInflowUsd),
    },
    {
      factor: 'liquidity',
      label: 'Liquidity expansion',
      weight: OPPORTUNITY_WEIGHTS.liquidity,
      strength: lpStrength(input.liquidityExpansionPct),
      direction:
        input.liquidityExpansionPct >= 8
          ? 'up'
          : input.liquidityExpansionPct <= -10
            ? 'risk'
            : 'neutral',
      evidence: `LP ${input.liquidityExpansionPct >= 0 ? '+' : ''}${input.liquidityExpansionPct.toFixed(0)}%`,
      sourceField: 'liquidityExpansionPct',
      present: Number.isFinite(input.liquidityExpansionPct),
    },
    {
      factor: 'holders',
      label: 'Holder growth',
      weight: OPPORTUNITY_WEIGHTS.holders,
      strength: holderStrength(input.holderGrowthPct),
      direction:
        input.holderGrowthPct >= 5
          ? 'up'
          : input.holderGrowthPct <= -5
            ? 'risk'
            : 'neutral',
      evidence: `Holders ${input.holderGrowthPct >= 0 ? '+' : ''}${input.holderGrowthPct.toFixed(0)}%`,
      sourceField: 'holderGrowthPct',
      present: Number.isFinite(input.holderGrowthPct),
    },
    {
      factor: 'insider_quiet',
      label: input.insiderClusterActive ? 'Insider cluster' : 'Insider quiet',
      weight: OPPORTUNITY_WEIGHTS.insiderQuiet,
      strength: insiderStrength(input.insiderClusterActive),
      direction: input.insiderClusterActive ? 'risk' : 'up',
      evidence: input.insiderClusterActive
        ? 'Cluster activity detected'
        : 'No insider cluster activity',
      sourceField: 'insiderClusterActive',
      present: true,
    },
    {
      factor: 'pool_age',
      label: 'Pool age',
      weight: OPPORTUNITY_WEIGHTS.poolAge,
      strength: poolAgeStrength(input.poolAgeHours),
      direction:
        input.poolAgeHours != null && input.poolAgeHours < 72 ? 'up' : 'neutral',
      evidence:
        input.poolAgeHours == null
          ? 'Pool age unknown'
          : `Pool age ${Math.round(input.poolAgeHours)}h`,
      sourceField: 'poolAgeHours',
      present: input.poolAgeHours != null,
    },
  ]

  const presentCount = raw.filter((r) => r.present).length
  const confidencePct = Math.round((presentCount / raw.length) * 100)
  if (confidencePct < 40) return null

  // Contribution = weight × strength for non-neutral factors with signal
  const contributing = raw.filter(
    (r) => r.present && r.direction !== 'neutral' && r.strength > 0.05,
  )
  if (contributing.length === 0) return null

  const denom = contributing.reduce((a, r) => a + r.weight * r.strength, 0)
  if (denom <= 0) return null

  let shares: AttributionShare[] = contributing.map((r) => ({
    factor: r.factor,
    label: r.label,
    sharePct: Math.round(((r.weight * r.strength) / denom) * 100),
    direction: r.direction,
    evidence: r.evidence,
    sourceField: r.sourceField,
  }))

  // Fix rounding so up-shares (or all if mixed) sum to 100 among up group preferred
  const up = shares.filter((s) => s.direction === 'up')
  const risk = shares.filter((s) => s.direction === 'risk')
  if (up.length > 0) {
    const upSum = up.reduce((a, s) => a + s.sharePct, 0)
    const delta = 100 - upSum
    if (delta !== 0) {
      // Adjust largest up share
      const largest = up.reduce((a, b) => (a.sharePct >= b.sharePct ? a : b))
      largest.sharePct = clamp(largest.sharePct + delta, 0, 100)
    }
    // Re-scale risk shares relative (keep as secondary context; don't force 100)
    shares = [...up, ...risk]
  } else {
    const sum = shares.reduce((a, s) => a + s.sharePct, 0)
    const delta = 100 - sum
    if (delta !== 0 && shares[0]) {
      shares[0].sharePct = clamp(shares[0].sharePct + delta, 0, 100)
    }
  }

  const explainedPct = shares
    .filter((s) => s.direction === 'up')
    .reduce((a, s) => a + s.sharePct, 0)

  return {
    mint: input.mint,
    symbol: input.symbol,
    shares,
    explainedPct: explainedPct > 0 ? explainedPct : shares.reduce((a, s) => a + s.sharePct, 0),
    confidencePct,
    method: 'causal-attribution-v1',
    disclaimer: DISCLAIMER,
  }
}
