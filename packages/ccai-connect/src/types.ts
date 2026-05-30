/** Supported chains for CCAI Connect v1. */
export type ConnectChainId = 'solana' | 'sol'

export type AssessDepth = 'fast' | 'institutional'

export type ScanResponseMode = 'platform' | 'full'

export type AssessRiskParams = {
  chain?: ConnectChainId
  address: string
  depth?: AssessDepth
  responseMode?: ScanResponseMode
  liquidityUsd?: number
  topHolderPct?: number
}

export type BatchScanItem = {
  tokenAddress: string
  chain?: ConnectChainId
}

export type ReputationParams = {
  chain: ConnectChainId
  address: string
}

/** Compact platform JSON from POST /api/v1/scan (responseMode=platform). */
export type PlatformScanResult = {
  score: number
  decision: string
  confidence: number
  risk_assessment: Record<string, unknown>
  risk_breakdown: { liquidity: number; wallet: number; contract: number }
  simulation: { status: string; buyable: boolean; sellable: boolean }
  wallet_intelligence: Record<string, unknown>
  timestamp: string
  meta?: Record<string, unknown>
  canonical?: Record<string, unknown>
}

/** Full institutional scan payload from POST /api/v1/scan. */
export type InstitutionalScanResult = {
  score: number
  confidence: number
  risk_breakdown: Record<string, unknown>
  reasoning: Record<string, unknown>
  wallet_reputation: Record<string, unknown>
  simulator: Record<string, unknown>
  rpc_provider: string
  pipeline_stages: unknown[]
  pipeline_ms: number
  last_updated: string
  cache: 'hit' | 'miss'
  canonical?: Record<string, unknown>
  meta: Record<string, unknown>
}

export type ReputationSnapshot = {
  chain: string
  address: string
  score: number
  verdict: string
  updatedAt: string
  source?: string
}
