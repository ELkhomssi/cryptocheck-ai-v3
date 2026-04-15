/**
 * Public developer-facing scan payload (B2B / integrations).
 * Distinct from the full institutional `ScanV1ApiResponse` used by the Pro dashboard.
 */
export type PlatformScanResponse = {
  score: number
  decision: 'Low Risk' | 'Moderate Risk' | 'High Risk'
  confidence: number
  risk_breakdown: {
    liquidity: number
    wallet: number
    contract: number
  }
  simulation: {
    status: string
    buyable: boolean
    sellable: boolean
  }
  wallet_intelligence: {
    cluster_risk: 'Low' | 'Medium' | 'High'
    top_holder_concentration: number
    linked_scam_wallets: boolean
  }
  timestamp: string
  /** Present for API key requests — helps reconcile usage vs dashboard. */
  meta?: {
    request_id?: string
    response_time_ms: number
    cache: 'hit' | 'miss'
    tier: string
    environment?: 'live' | 'sandbox'
  }
}
