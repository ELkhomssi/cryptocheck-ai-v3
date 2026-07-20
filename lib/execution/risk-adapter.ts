/**
 * Risk + safety adapters — wrap scan-gateway + risk-gated-swap only.
 */
import 'server-only'

import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { assessSwapIntent } from '@/lib/trading/risk-gated-swap'
import { SOL_MINT } from '@/lib/trading/platform-fee-config'
import type {
  ExecutionSafetyScore,
  OpportunityIntake,
  RiskValidationReport,
  StrategyConfig,
} from './types'
import { riskCategoryFromScore } from './types'

export async function validateOpportunityRisk(opp: OpportunityIntake): Promise<RiskValidationReport> {
  const assessment = await assessRiskByMint(opp.mint, 'solana', 'fast')
  const riskScore = assessment.riskScore
  const category = riskCategoryFromScore(riskScore)

  const snap = assessment.snapshot
  const factors = snap?.reasoning?.evidence ?? []

  const mintAuthorityActive = factors.some((e) =>
    /mint authority/i.test(e.label) && !/revoked|none|disabled/i.test(e.label),
  )
  const freezeAuthorityActive = factors.some((e) => /freeze authority/i.test(e.label))

  let verdict: RiskValidationReport['verdict'] = 'CAUTION'
  if (assessment.verdict === 'BLOCKED' || riskScore >= 80) verdict = 'BLOCKED'
  else if (riskScore >= 70) verdict = 'DANGER'
  else if (riskScore >= 45) verdict = 'HIGH_RISK'
  else if (riskScore <= 25) verdict = 'SAFE'

  return {
    opportunityId: opp.opportunityId,
    riskScore,
    category,
    verdict,
    mintAuthorityActive,
    freezeAuthorityActive,
    liquidityUsd: null,
    holderConcentrationPct: null,
    tokenAgeSec: null,
    transferRestricted: null,
    metadataOk: true,
    reasons: factors.slice(0, 8).map((e) => e.label),
    warnings: [],
    scannedAt: new Date().toISOString(),
    gatewayPath: 'assessRiskByMint',
  }
}

export async function computeSafetyScore(
  opp: OpportunityIntake,
  risk: RiskValidationReport,
  cfg: StrategyConfig,
): Promise<ExecutionSafetyScore> {
  const authorityRisk = (risk.mintAuthorityActive ? 35 : 0) + (risk.freezeAuthorityActive ? 25 : 0)
  const concentrationRisk = Math.min(40, Math.max(0, (risk.holderConcentrationPct ?? 0) - 20))
  const liquidityHealth = risk.liquidityUsd == null
    ? 50
    : Math.min(100, Math.round((risk.liquidityUsd / Math.max(cfg.minLiquidityUsd, 1)) * 70))
  const poolQuality = risk.verdict === 'SAFE' ? 90 : risk.verdict === 'CAUTION' ? 70 : 40

  const scamIndicators: string[] = []
  if (risk.category === 'critical') scamIndicators.push('CRITICAL_RISK_SCORE')
  if (risk.mintAuthorityActive) scamIndicators.push('MINT_AUTHORITY_ACTIVE')
  if (risk.freezeAuthorityActive) scamIndicators.push('FREEZE_AUTHORITY_ACTIVE')

  const raw =
    0.35 * liquidityHealth +
    0.25 * poolQuality +
    0.2 * (100 - authorityRisk) +
    0.2 * (100 - concentrationRisk)
  const score = Math.max(0, Math.min(100, Math.round(raw)))

  return {
    opportunityId: opp.opportunityId,
    score,
    passed: score >= cfg.minSafetyScore && risk.category !== 'critical',
    liquidityHealth,
    poolQuality,
    authorityRisk,
    concentrationRisk,
    scamIndicators,
    thresholdRequired: cfg.minSafetyScore,
  }
}

/** Reuse existing swap intent assessor for buy SOL→mint path. */
export async function assessBuyIntentCompat(opp: OpportunityIntake) {
  const solUsd = 150
  const amountUsd = (opp.amountSol ?? 0) * solUsd
  return assessSwapIntent({
    walletAddress: opp.walletAddress,
    fromToken: SOL_MINT,
    toToken: opp.mint,
    amountUsd,
    slippageBps: opp.maxSlippageBps,
    chain: 'solana',
  })
}
