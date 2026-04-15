import type { ReasoningObject, Verdict } from '@/lib/services/scanner-engine'
import type { InstitutionalScanSnapshot } from '@/lib/services/scanner/types'
import type { PlatformScanResponse } from '@/lib/types/platform-scan-api'
import { deriveRiskAssessment } from '@/lib/services/scanner/risk-assessment'

function extractTopHolderPct(r: ReasoningObject): number {
  const line = r.evidence.find((e) => e.id === 'ev_concentration')
  const m = line?.detail.match(/(\d+\.?\d*)%/)
  if (m) return Math.min(100, Math.max(0, parseFloat(m[1])))
  return 12
}

function verdictToDecision(verdict: Verdict): PlatformScanResponse['decision'] {
  if (verdict === 'SAFE') return 'Low Risk'
  if (verdict === 'CAUTION') return 'Moderate Risk'
  return 'High Risk'
}

function clusterLabel(risk: 'low' | 'medium' | 'high'): PlatformScanResponse['wallet_intelligence']['cluster_risk'] {
  if (risk === 'low') return 'Low'
  if (risk === 'medium') return 'Medium'
  return 'High'
}

const SIM_STATUS =
  'Simulation executed via RPC sandbox — routes validated without broadcasting transactions.'

/**
 * Maps the full institutional snapshot into the compact developer API contract.
 */
export function mapSnapshotToPlatformResponse(
  snapshot: InstitutionalScanSnapshot,
  opts: {
    responseTimeMs: number
    cache: 'hit' | 'miss'
    tier: string
    environment?: 'live' | 'sandbox'
    requestId?: string
  }
): PlatformScanResponse {
  const { weighted, reasoning, simulator, updatedAt } = snapshot
  const topPct = extractTopHolderPct(reasoning)
  const hits = reasoning.clusterAnalysis.scamLinkedFundingHits

  return {
    score: Math.round(weighted.score),
    decision: verdictToDecision(reasoning.verdict),
    confidence: Math.round(weighted.confidence * 1000) / 1000,
    risk_assessment: deriveRiskAssessment(snapshot),
    risk_breakdown: {
      liquidity: Math.round(weighted.risk_breakdown.liquidity_risk),
      wallet: Math.round(weighted.risk_breakdown.wallet_risk),
      contract: Math.round(weighted.risk_breakdown.contract_risk),
    },
    simulation: {
      status: SIM_STATUS,
      buyable: simulator.buy.ok,
      sellable: simulator.sell.ok,
    },
    wallet_intelligence: {
      cluster_risk: clusterLabel(reasoning.clusterAnalysis.linkedCreatorRisk),
      top_holder_concentration: Math.round(topPct * 10) / 10,
      linked_scam_wallets: hits > 0,
    },
    timestamp: updatedAt,
    meta: {
      response_time_ms: opts.responseTimeMs,
      cache: opts.cache,
      tier: opts.tier,
      ...(opts.environment ? { environment: opts.environment } : {}),
      ...(opts.requestId ? { request_id: opts.requestId } : {}),
    },
  }
}
