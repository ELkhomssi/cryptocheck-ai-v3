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

  const liqLine = reasoning.evidence.find((e) => e.id === 'ev_liquidity' || e.id === 'ev_liquidity_unknown')
  const liqDetail = liqLine?.detail ?? ''

  let liquidity_status: LiquidityStatus = 'Safe'
  if (flags.has('missing_liquidity') || liqDetail.includes('not available')) {
    liquidity_status = 'Thin'
  } else if (flags.has('thin_liquidity')) {
    liquidity_status = 'Thin'
  } else if (liqRisk >= 50 || liqDetail.includes('very thin')) {
    liquidity_status = 'Volatile'
  } else if (liqRisk >= 24 || liqDetail.includes('below typical institutional')) {
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
