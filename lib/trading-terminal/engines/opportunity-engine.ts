/**
 * PROMPT 14 — AI Opportunity Engine
 *
 * Conviction is DERIVED from measured inputs + stated weights.
 * confidencePct scales with input coverage. Thin data → low confidence
 * or empty — never a confident guess.
 *
 * Attribution shares are model estimates, not ground truth.
 */

export type OpportunityStage =
  | 'EARLY'
  | 'BUILDING'
  | 'BREAKOUT'
  | 'EXTENDED'
  | 'EXITING'

export type OpportunityRisk = 'LOW' | 'MEDIUM' | 'HIGH'

export type OpportunityMeasuredInputs = {
  mint: string
  symbol: string
  /** Net smart-money flow USD over window (signed). */
  smartMoneyNetInflowUsd: number
  /** LP depth change % over window. */
  liquidityExpansionPct: number
  /** Holder count change % over window. */
  holderGrowthPct: number
  /** True if insider/deployer cluster showed activity. */
  insiderClusterActive: boolean
  /** Pool age in hours when known. */
  poolAgeHours: number | null
  /** Risk score 0–100 from scan gateway when known. */
  riskScore: number | null
}

export type OpportunityReason = {
  text: string
  sourceField: keyof OpportunityMeasuredInputs | 'derived'
  direction: 'up' | 'risk'
}

export type Opportunity = {
  mint: string
  symbol: string
  convictionScore: number
  confidencePct: number
  riskLevel: OpportunityRisk
  stage: OpportunityStage
  reasons: OpportunityReason[]
  whyNow: string
  measuredInputs: OpportunityMeasuredInputs
  method: 'opportunity-engine-v1'
}

/** Documented weights — sum = 1.0 */
export const OPPORTUNITY_WEIGHTS = {
  smartMoney: 0.35,
  liquidity: 0.25,
  holders: 0.2,
  insiderQuiet: 0.1,
  poolAge: 0.1,
} as const

/**
 * Stage thresholds (measurable).
 * EARLY: SM entering + young pool + rising holders
 * BUILDING: SM + LP expansion both positive
 * BREAKOUT: strong SM + LP + holders
 * EXTENDED: still positive but pool older / weaker growth
 * EXITING: SM outflow or LP removal
 */
export function classifyStage(input: OpportunityMeasuredInputs): OpportunityStage {
  if (input.smartMoneyNetInflowUsd < -10_000 || input.liquidityExpansionPct <= -15) {
    return 'EXITING'
  }
  const strongSm = input.smartMoneyNetInflowUsd >= 50_000
  const strongLp = input.liquidityExpansionPct >= 15
  const strongHolders = input.holderGrowthPct >= 10
  const young = input.poolAgeHours != null && input.poolAgeHours < 48

  if (strongSm && strongLp && strongHolders) return 'BREAKOUT'
  if (strongSm && strongLp) return 'BUILDING'
  if (young && input.smartMoneyNetInflowUsd > 0 && input.holderGrowthPct > 0) return 'EARLY'
  if (input.smartMoneyNetInflowUsd > 0 || input.liquidityExpansionPct > 5) return 'EXTENDED'
  return 'EARLY'
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function scoreSmartMoney(usd: number): number {
  // Map −100k..+200k → 0..1
  return clamp((usd + 100_000) / 300_000, 0, 1)
}

function scoreLiquidity(pct: number): number {
  return clamp((pct + 20) / 60, 0, 1)
}

function scoreHolders(pct: number): number {
  return clamp((pct + 5) / 30, 0, 1)
}

function scoreInsiderQuiet(active: boolean): number {
  return active ? 0.15 : 1
}

function scorePoolAge(hours: number | null): number {
  if (hours == null) return 0.5 // unknown → neutral, reduces confidence
  if (hours < 24) return 0.95
  if (hours < 72) return 0.75
  if (hours < 168) return 0.55
  return 0.35
}

function riskFromScore(riskScore: number | null, stage: OpportunityStage): OpportunityRisk {
  if (stage === 'EXITING') return 'HIGH'
  if (riskScore == null) return 'MEDIUM'
  if (riskScore >= 60) return 'HIGH'
  if (riskScore >= 35) return 'MEDIUM'
  return 'LOW'
}

/** Build evidence bullets from measured inputs only — never pad. */
export function buildOpportunityReasons(input: OpportunityMeasuredInputs): OpportunityReason[] {
  const out: OpportunityReason[] = []
  if (input.smartMoneyNetInflowUsd >= 20_000) {
    out.push({
      text: `Smart money inflow +$${Math.round(input.smartMoneyNetInflowUsd / 1000)}k`,
      sourceField: 'smartMoneyNetInflowUsd',
      direction: 'up',
    })
  } else if (input.smartMoneyNetInflowUsd <= -20_000) {
    out.push({
      text: `Smart money outflow −$${Math.round(Math.abs(input.smartMoneyNetInflowUsd) / 1000)}k`,
      sourceField: 'smartMoneyNetInflowUsd',
      direction: 'risk',
    })
  }
  if (input.liquidityExpansionPct >= 8) {
    out.push({
      text: `LP expansion +${input.liquidityExpansionPct.toFixed(0)}%`,
      sourceField: 'liquidityExpansionPct',
      direction: 'up',
    })
  } else if (input.liquidityExpansionPct <= -10) {
    out.push({
      text: `LP deterioration ${input.liquidityExpansionPct.toFixed(0)}%`,
      sourceField: 'liquidityExpansionPct',
      direction: 'risk',
    })
  }
  if (input.holderGrowthPct >= 5) {
    out.push({
      text: `Holder growth +${input.holderGrowthPct.toFixed(0)}%`,
      sourceField: 'holderGrowthPct',
      direction: 'up',
    })
  }
  if (!input.insiderClusterActive) {
    out.push({
      text: 'No insider cluster activity detected',
      sourceField: 'insiderClusterActive',
      direction: 'up',
    })
  } else {
    out.push({
      text: 'Insider cluster activity detected',
      sourceField: 'insiderClusterActive',
      direction: 'risk',
    })
  }
  return out.slice(0, 4)
}

/**
 * Score one token. Returns null when inputs are too thin to clear thresholds
 * (honest empty — no manufactured opportunity).
 */
export function scoreOpportunity(input: OpportunityMeasuredInputs): Opportunity | null {
  const present: string[] = []
  if (Number.isFinite(input.smartMoneyNetInflowUsd)) present.push('smartMoney')
  if (Number.isFinite(input.liquidityExpansionPct)) present.push('liquidity')
  if (Number.isFinite(input.holderGrowthPct)) present.push('holders')
  present.push('insiderQuiet')
  if (input.poolAgeHours != null) present.push('poolAge')

  const coverage = present.length / 5
  const confidencePct = Math.round(coverage * 100)

  // Gate: need SM or LP signal at minimum
  const hasSignal =
    Math.abs(input.smartMoneyNetInflowUsd) >= 15_000 ||
    Math.abs(input.liquidityExpansionPct) >= 8 ||
    input.holderGrowthPct >= 8

  if (!hasSignal) return null

  const stage = classifyStage(input)
  if (stage === 'EXITING') return null // opportunities = long-biased; exits go to threats/actions

  const raw =
    OPPORTUNITY_WEIGHTS.smartMoney * scoreSmartMoney(input.smartMoneyNetInflowUsd) +
    OPPORTUNITY_WEIGHTS.liquidity * scoreLiquidity(input.liquidityExpansionPct) +
    OPPORTUNITY_WEIGHTS.holders * scoreHolders(input.holderGrowthPct) +
    OPPORTUNITY_WEIGHTS.insiderQuiet * scoreInsiderQuiet(input.insiderClusterActive) +
    OPPORTUNITY_WEIGHTS.poolAge * scorePoolAge(input.poolAgeHours)

  const convictionScore = Math.round(clamp(raw, 0, 1) * 100)

  // Qualify threshold — don't surface weak noise
  if (convictionScore < 55 || confidencePct < 40) return null

  const reasons = buildOpportunityReasons(input)
  if (reasons.length === 0) return null

  const whyNow = reasons
    .filter((r) => r.direction === 'up')
    .slice(0, 2)
    .map((r) => r.text)
    .join(' · ')

  return {
    mint: input.mint,
    symbol: input.symbol,
    convictionScore,
    confidencePct,
    riskLevel: riskFromScore(input.riskScore, stage),
    stage,
    reasons,
    whyNow: whyNow || reasons[0]!.text,
    measuredInputs: input,
    method: 'opportunity-engine-v1',
  }
}

/** Rank and filter a batch of measured inputs. */
export function rankOpportunities(inputs: OpportunityMeasuredInputs[]): Opportunity[] {
  return inputs
    .map(scoreOpportunity)
    .filter((o): o is Opportunity => o != null)
    .sort((a, b) => b.convictionScore - a.convictionScore || b.confidencePct - a.confidencePct)
}
