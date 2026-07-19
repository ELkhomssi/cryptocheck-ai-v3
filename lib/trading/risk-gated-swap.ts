/**
 * Risk-gated swap engine — every swap is risk-scored (via the scan gateway, fast mode)
 * before it can execute. Score 80+ is a hard block with no override.
 * Applies to ALL mints (including tokens launched via CryptoCheck LaunchLab).
 */

import 'server-only'

import { assessRiskByMint, type MintRiskAssessment } from '@/lib/connect/scan-gateway'
import { simulateJupiterSwap } from '@/lib/trading/jupiter-client'

export interface SwapIntent {
  walletAddress: string
  fromToken: string
  toToken: string
  amountUsd: number
  slippageBps: number
  /** Solana-only today; the scanner has no EVM port yet. */
  chain: 'solana'
}

export type SwapWarning =
  | 'LOW_LIQUIDITY'
  | 'HIGH_PRICE_IMPACT'
  | 'HONEYPOT_RISK'
  | 'MINT_AUTHORITY_ACTIVE'
  | 'NEW_TOKEN_UNDER_24H'
  | 'TOP_HOLDER_CONCENTRATION'
  | 'FREEZE_AUTHORITY_ACTIVE'
  | 'LP_UNLOCKED'
  | 'RUGPULL_PATTERN_DETECTED'

export interface SwapDecision {
  allowed: boolean
  riskScore: number
  confidence: 'high' | 'medium' | 'low'
  verdict: 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'BLOCKED'
  reasons: string[]
  simulatedPriceImpact?: number
  estimatedOutput?: number
  warnings: SwapWarning[]
  blockedReason?: string
}

export interface SwapResult {
  signature: string
  intent: SwapIntent
  decision: SwapDecision
}

export class SwapBlockedError extends Error {
  constructor(
    readonly blockedReason: string,
    readonly decision: SwapDecision
  ) {
    super(blockedReason)
    this.name = 'SwapBlockedError'
  }
}

export class SwapRequiresConfirmError extends Error {
  constructor(readonly decision: SwapDecision) {
    super('Swap requires explicit high-risk confirmation')
    this.name = 'SwapRequiresConfirmError'
  }
}

/** Whale-protection threshold: large notional + elevated risk is always blocked. */
const WHALE_NOTIONAL_USD = 10_000
const WHALE_RISK_FLOOR = 50
const HARD_BLOCK_SCORE = 80
const HIGH_PRICE_IMPACT_PCT = 2

function buildWarnings(
  risk: MintRiskAssessment,
  sim: { priceImpactPct: number } | null,
  intent: SwapIntent
): { warnings: SwapWarning[]; reasons: string[] } {
  const warnings = new Set<SwapWarning>()
  const reasons: string[] = []
  const { snapshot } = risk
  const flags = new Set(snapshot.reasoning.flags)

  if (flags.has('missing_liquidity') || flags.has('thin_liquidity')) {
    warnings.add('LOW_LIQUIDITY')
    reasons.push('Liquidity is thin or unavailable for this token.')
  }
  if (flags.has('mint_authority_active')) {
    warnings.add('MINT_AUTHORITY_ACTIVE')
    reasons.push('Mint authority is still active — supply can be inflated.')
  }
  if (flags.has('freeze_authority_active')) {
    warnings.add('FREEZE_AUTHORITY_ACTIVE')
    reasons.push('Freeze authority is active — your tokens could be frozen.')
  }
  if (snapshot.reasoning.clusterAnalysis.linkedCreatorRisk === 'high' || flags.has('mixer_funding_trail')) {
    warnings.add('RUGPULL_PATTERN_DETECTED')
    reasons.push('Creator wallet shows rugpull-associated funding patterns.')
  }
  if (snapshot.simulator?.honeypotLikelihood === 'high' || snapshot.simulator?.sell?.ok === false) {
    warnings.add('HONEYPOT_RISK')
    reasons.push('Sell-path simulation failed — possible honeypot.')
  }
  if (flags.has('lp_unlocked')) {
    warnings.add('LP_UNLOCKED')
    reasons.push('Liquidity is not locked or burned.')
  }
  if (flags.has('new_pair') || flags.has('new_token')) {
    warnings.add('NEW_TOKEN_UNDER_24H')
    reasons.push('Token/pair is less than 24h old.')
  }

  const concentrationLine = snapshot.reasoning.evidence.find((e) => e.id === 'ev_concentration')
  if (concentrationLine && concentrationLine.riskContribution > 0) {
    warnings.add('TOP_HOLDER_CONCENTRATION')
    reasons.push('Top holders control a large share of supply.')
  }

  if (sim && sim.priceImpactPct > HIGH_PRICE_IMPACT_PCT) {
    warnings.add('HIGH_PRICE_IMPACT')
    reasons.push(`Price impact ~${sim.priceImpactPct.toFixed(2)}% on a $${intent.amountUsd} swap.`)
  }

  return { warnings: Array.from(warnings), reasons }
}

const SOL_MINT = 'So11111111111111111111111111111111111111112'

/** Best-effort lamport sizing for the sim (USD → SOL → lamports). Fast, approximate. */
function approxLamportsForUsd(amountUsd: number, solPriceUsd = 150): number {
  const sol = amountUsd / solPriceUsd
  return Math.max(1, Math.floor(sol * 1e9))
}

/**
 * Risk-scores a swap intent. Always fast mode (sub-200ms target).
 * Decision bands (riskScore = 100 − safety):
 *   0–30 → SAFE (allowed)
 *   31–59 → CAUTION (allowed, warnings surfaced)
 *   60–79 → HIGH_RISK (allowed only with explicit user confirm)
 *   80+   → BLOCKED (hard, no override)
 *   whale: amountUsd > 10k AND risk > 50 → BLOCKED
 */
export async function assessSwapIntent(intent: SwapIntent): Promise<SwapDecision> {
  const risk = await assessRiskByMint(intent.toToken, 'solana', 'fast')

  let sim: { priceImpactPct: number; outAmount: number } | null = null
  try {
    sim = await simulateJupiterSwap(
      intent.fromToken || SOL_MINT,
      intent.toToken,
      approxLamportsForUsd(intent.amountUsd),
      intent.slippageBps
    )
  } catch {
    // Simulation is best-effort; risk score still governs the decision.
    sim = null
  }

  const { warnings, reasons } = buildWarnings(risk, sim, intent)
  const riskScore = risk.riskScore

  let verdict: SwapDecision['verdict'] = risk.verdict
  let allowed = true
  let blockedReason: string | undefined

  if (riskScore >= HARD_BLOCK_SCORE) {
    allowed = false
    verdict = 'BLOCKED'
    blockedReason = `Token risk score ${riskScore}/100 exceeds the hard block threshold.`
  } else if (intent.amountUsd > WHALE_NOTIONAL_USD && riskScore > WHALE_RISK_FLOOR) {
    allowed = false
    verdict = 'BLOCKED'
    blockedReason = `Whale protection: $${intent.amountUsd.toLocaleString()} swap with risk score ${riskScore} is blocked.`
  } else if (riskScore >= 60) {
    verdict = 'HIGH_RISK'
  } else if (riskScore >= 31) {
    verdict = 'CAUTION'
  } else {
    verdict = 'SAFE'
  }

  return {
    allowed,
    riskScore,
    confidence: risk.confidence,
    verdict,
    reasons,
    simulatedPriceImpact: sim?.priceImpactPct,
    estimatedOutput: sim?.outAmount,
    warnings,
    blockedReason,
  }
}

/**
 * Mint-level risk gate shared by Jupiter and LaunchLAB Raydium bonding-curve paths.
 * Thin alias — always delegates to `assessSwapIntent` (same module, same thresholds).
 * Bonding-curve mints typically have no Jupiter route; `assessSwapIntent` already
 * treats sim failure as best-effort and still applies hard-block / whale rules.
 */
export async function validateTokenRisk(
  mintAddress: string,
  options?: {
    walletAddress?: string
    amountUsd?: number
    slippageBps?: number
  },
): Promise<SwapDecision> {
  return assessSwapIntent({
    walletAddress: options?.walletAddress ?? '',
    fromToken: SOL_MINT,
    toToken: mintAddress,
    amountUsd: options?.amountUsd ?? 1,
    slippageBps: options?.slippageBps ?? 100,
    chain: 'solana',
  })
}

/** DANGER-gate error for LaunchLAB UI — mirrors SwapBlockedError semantics. */
export class LaunchLabBlockedError extends Error {
  constructor(
    readonly reasons: string[],
    readonly decision: SwapDecision,
  ) {
    super(decision.blockedReason ?? (reasons.join('; ') || 'Trade blocked by risk policy'))
    this.name = 'LaunchLabBlockedError'
  }
}

/** Executes a swap only after a passing risk assessment. `swapExecutor` performs the actual on-chain swap. */
export async function executeRiskGatedSwap(
  intent: SwapIntent,
  userConfirmed: boolean,
  swapExecutor: (intent: SwapIntent) => Promise<{ signature: string }>
): Promise<SwapResult> {
  const decision = await assessSwapIntent(intent)

  if (!decision.allowed) {
    throw new SwapBlockedError(decision.blockedReason ?? 'Swap blocked by risk policy', decision)
  }
  if (decision.verdict === 'HIGH_RISK' && !userConfirmed) {
    throw new SwapRequiresConfirmError(decision)
  }

  const { signature } = await swapExecutor(intent)
  return { signature, intent, decision }
}
