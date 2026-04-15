import type { ReasoningObject } from '@/lib/services/scanner-engine'
import type {
  PipelineStageRecord,
  TransactionSimulatorResult,
  WeightedSecurityScore,
} from '@/lib/services/scanner/types'

/** POST `/api/v1/scan` JSON body (institutional). */
export type ScanV1ApiResponse = {
  score: number
  confidence: number
  risk_breakdown: WeightedSecurityScore['risk_breakdown']
  reasoning: ReasoningObject
  wallet_reputation: { score0to100: number; summary: string }
  simulator: TransactionSimulatorResult
  rpc_provider: string
  pipeline_stages: PipelineStageRecord[]
  pipeline_ms: number
  last_updated: string
  cache: 'hit' | 'miss'
  meta: {
    response_time_ms: number
    auth_via: 'api_key' | 'session'
    user_id: string
  }
}
