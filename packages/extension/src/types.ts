/**
 * Extension-local API types (copied from lib/types/intelligence.ts — keep in sync).
 */

export type KeyTier = 'v1' | 'v2'

export type PublicSubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE'

export type RateLimitPrimitives = {
  maxRequests: number
  windowSeconds: number
}

export type KeyVerifySuccess = {
  valid: true
  keyTier: KeyTier
  keyName: string
  subscriptionTier: PublicSubscriptionTier
  rateLimit: RateLimitPrimitives
}

export type AuthorityField = {
  address: string | null
  renounced: boolean
}

export type TopHolderRow = {
  address: string
  pct: number
  isContract: boolean
  isLp: boolean
}

export type LiquidityLockInfo = {
  status: 'burned' | 'locked' | 'unlocked' | 'unknown'
  burnedPct: number | null
  lockUntil: string | null
  reason?: string | null
}

export type RiskSignal = {
  code: string
  severity: 'info' | 'warn' | 'danger'
  message: string
  impact: number
}

export type RiskVerdict = 'SAFE' | 'CAUTION' | 'RISKY' | 'DANGER'

export type TokenIntelligenceMeta = {
  scannedAt: string
  cacheAge: number
  scanId: string
  keyTier: KeyTier
  subscriptionTier: PublicSubscriptionTier
}

export type TokenIntelligenceReport = {
  mint: string
  name: string
  symbol: string
  imageUrl: string | null
  decimals: number
  supply: { raw: string; ui: number | null }

  price: number | null
  priceChange24h: number | null
  marketCap: number | null
  volume24h: number | null
  liquidityUsd: number | null
  pairAgeDays: number | null

  mintAuthority?: AuthorityField | null
  freezeAuthority?: AuthorityField | null
  updateAuthority?: AuthorityField | null

  topHolders?: TopHolderRow[] | null
  top10Concentration?: number | null

  liquidityLock?: LiquidityLockInfo | null

  riskScore?: number | null
  riskVerdict?: RiskVerdict | null
  riskSignals?: RiskSignal[] | null

  recentTxCount?: number | null

  meta: TokenIntelligenceMeta
}
