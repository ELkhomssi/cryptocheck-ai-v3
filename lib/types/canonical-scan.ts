export type CanonicalVerdict = 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'AVOID'

export type SignalEntry = {
  code: string
  severity: 'info' | 'warn' | 'danger'
  message: string
  impact: number
}

export type CanonicalLiquidityStatus = 'verified' | 'locked' | 'burned' | 'unverified' | 'no_pair'

export type CanonicalScanResult = {
  mint: string
  riskScore: number
  verdict: CanonicalVerdict
  verdictReason: string
  signals: SignalEntry[]
  liquidity: {
    status: CanonicalLiquidityStatus
    lockUntil?: string
    burnPercentage?: number
    dexPairAddress?: string
    reason: string
  }
  authorities: {
    mint: 'renounced' | 'active' | 'unknown'
    freeze: 'renounced' | 'active' | 'unknown'
    update: 'renounced' | 'active' | 'unknown'
  }
  topHolderConcentration: number
  generatedAt: string
  cacheKey: string
}
