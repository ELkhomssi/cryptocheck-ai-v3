import type { InstitutionalScanSnapshot } from '@/lib/services/scanner/types'

export type LiquidityStatus = 'Safe' | 'Thin' | 'Volatile'
export type MintStatus = 'Renounced' | 'Active' | 'Hidden'

export type RiskAssessment = {
  rug_score: number
  liquidity_status: LiquidityStatus
  mint_status: MintStatus
  insider_flag: boolean
}

function extractTopHolderPctFromReasoning(snapshot: InstitutionalScanSnapshot): number {
  const line = snapshot.reasoning.evidence.find((e) => e.id === 'ev_concentration')
  const m = line?.detail.match(/(\d+\.?\d*)%/)
  if (m) return Math.min(100, Math.max(0, parseFloat(m[1])))
  return 0
}

/**
 * Bloomberg-style flat risk object for `responseMode: platform` integrations.
 * `rug_score` rises as safety (`weighted.score`) falls.
 */
export function deriveRiskAssessment(snapshot: InstitutionalScanSnapshot): RiskAssessment {
  const { weighted, reasoning } = snapshot
  const flags = new Set(reasoning.flags)
  const liqRisk = weighted.risk_breakdown.liquidity_risk

  let liquidity_status: LiquidityStatus = 'Safe'
  if (flags.has('thin_liquidity') || flags.has('missing_liquidity')) {
    liquidity_status = 'Thin'
  } else if (liqRisk >= 50) {
    liquidity_status = 'Volatile'
  } else if (liqRisk >= 28) {
    liquidity_status = 'Thin'
  }

  let mint_status: MintStatus = 'Hidden'
  if (flags.has('mint_authority_active')) {
    mint_status = 'Active'
  } else if (reasoning.evidence.some((e) => e.id === 'ev_mint_revoked')) {
    mint_status = 'Renounced'
  }

  const topPct = extractTopHolderPctFromReasoning(snapshot)
  const insider_flag =
    reasoning.clusterAnalysis.scamLinkedFundingHits > 0 ||
    reasoning.clusterAnalysis.linkedCreatorRisk === 'high' ||
    topPct > 35

  const rug_score = Math.max(0, Math.min(100, 100 - Math.round(weighted.score)))

  return { rug_score, liquidity_status, mint_status, insider_flag }
}
