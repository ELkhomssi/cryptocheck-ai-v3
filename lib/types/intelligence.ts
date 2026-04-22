/**
 * Shared types for POST /api/v1/intelligence/scan and the Intelligence Terminal UI.
 */

import type { SubscriptionTier } from '@/lib/types/tier'

/** Maps runtime subscription tier to public API enum. */
export function subscriptionTierToPublic(t: SubscriptionTier): PublicSubscriptionTier {
  if (t === 'institutional') return 'ENTERPRISE'
  if (t === 'pro') return 'PRO'
  return 'FREE'
}

/** Product key kind — drives blurred vs full UI. */
export type KeyTier = 'v1' | 'v2'

/** Display tier for API responses (maps `institutional` → ENTERPRISE). */
export type PublicSubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE'

/** Honest rate-limit primitives for verify + docs. */
export type RateLimitPrimitives = {
  maxRequests: number
  windowSeconds: number
}

/** POST /api/v1/keys/verify success body. */
export type KeyVerifySuccess = {
  valid: true
  keyTier: KeyTier
  keyName: string
  subscriptionTier: PublicSubscriptionTier
  rateLimit: RateLimitPrimitives
}

export type AuthorityField = {
  address: string | null
  /** True when authority is absent / revoked for that lane. */
  renounced: boolean
}

export type TopHolderRow = {
  address: string
  /** Percent of total supply, 0–100. */
  pct: number
  isContract: boolean
  isLp: boolean
}

export type LiquidityLockInfo = {
  status: 'burned' | 'locked' | 'unlocked' | 'unknown'
  /** 0–100 when known; null if unknown. */
  burnedPct: number | null
  lockUntil: string | null
  /** Human-readable reason shown in UI tooltip/context. */
  reason?: string | null
}

export type InsiderFlagRow = {
  address: string
  reason: string
  severity: 'low' | 'medium' | 'high'
}

export type RiskSignal = {
  code: string
  severity: 'info' | 'warn' | 'danger'
  message: string
  /** Points added (positive) or subtracted (negative) from neutral 50. */
  impact: number
}

export type RiskVerdict = 'SAFE' | 'CAUTION' | 'RISKY' | 'DANGER'

export type TokenIntelligenceMeta = {
  scannedAt: string
  /** Approximate seconds since upstream cache was populated. */
  cacheAge: number
  scanId: string
  keyTier: KeyTier
  subscriptionTier: PublicSubscriptionTier
}

/**
 * Full intelligence payload. v2-only fields are omitted or null when `meta.keyTier === 'v1'`.
 */
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

  /** Null when heuristic skipped (e.g. Sentinel Labs preview / too expensive). */
  insiderFlags?: InsiderFlagRow[] | null

  riskScore?: number | null
  riskVerdict?: RiskVerdict | null
  riskSignals?: RiskSignal[] | null

  /** Recent transaction count from Helius (best-effort). */
  recentTxCount?: number | null

  meta: TokenIntelligenceMeta
}
