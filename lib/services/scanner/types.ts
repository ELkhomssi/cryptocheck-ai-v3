import type { ReasoningObject } from '@/lib/services/scanner-engine'

/** Explainable aggregate output (institutional API contract). */
export type WeightedSecurityScore = {
  /** 0–100 safety score (higher = safer). Mirrors reasoning.aggregateScore. */
  score: number
  /** 0–1 confidence in data inputs / pipeline completeness. */
  confidence: number
  /** 0–100 risk points per bucket (higher = more risk in that dimension). */
  risk_breakdown: {
    liquidity_risk: number
    wallet_risk: number
    contract_risk: number
  }
}

export type PipelineStageName =
  | 'token_data_fetch'
  | 'wallet_analysis'
  | 'liquidity_analysis'
  | 'transaction_simulation'
  | 'pattern_matching'
  | 'scoring'

export type PipelineStageRecord = {
  name: PipelineStageName
  durationMs: number
  ok: boolean
  detail?: string
}

export type TransactionSimulatorResult = {
  buy: { ok: boolean; path: string; summary: string }
  sell: { ok: boolean; path: string; summary: string }
  honeypotLikelihood: 'low' | 'medium' | 'high'
  notes: string
}

export type InstitutionalScanSnapshot = {
  reasoning: ReasoningObject
  weighted: WeightedSecurityScore
  walletReputation: {
    score0to100: number
    summary: string
  }
  rpcProviderLabel: string
  stages: PipelineStageRecord[]
  simulator: TransactionSimulatorResult
  totalPipelineMs: number
  updatedAt: string
}

export type ScanExecutionMeta = {
  cache: 'hit' | 'miss'
  responseTimeMs: number
  userId: string
  authVia: 'api_key' | 'session'
  /** True when on-chain enrichment failed (e.g. HELIUS_API_KEY unset) — result is low-confidence. */
  enrichmentFailed?: boolean
}

export type { ReasoningObject }
