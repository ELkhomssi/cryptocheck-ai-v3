import type { RevenueVerdict } from '@/lib/revenue-dashboard/types'

export { LAUNCH_COMPLIANCE } from './constants'

/** Curve presets exposed in the Action Panel Launch form. */
export type LaunchCurvePreset = 'justsendit' | 'custom'

export type LaunchSocialLinks = {
  website?: string
  twitter?: string
  telegram?: string
  discord?: string
}

/** Client-safe fee breakdown shape (keep in sync with lib/launch/estimate-fees.ts). */
export type LaunchFeeBreakdown = {
  cluster: 'mainnet' | 'devnet'
  decimals: number
  platformCreateFeeSol: number
  networkFeeSol: number
  rentSol: number
  metadataCostSol: number
  totalSol: number
  lines: Array<{
    id: 'platform_create' | 'network' | 'rent' | 'metadata' | 'total'
    label: string
    sol: number
    note?: string
  }>
  curveFees: {
    platformFeeBpsApprox: number
    creatorFeeBpsApprox: number
    platformFeeRate: number
    creatorFeeRate: number
    denominator: number
    note: string
  }
  walletBalanceSol: number | null
  sufficientBalance: boolean | null
  estimatedAt: string
}

export type LaunchPrepareInput = {
  name: string
  ticker: string
  description?: string
  imageUrl: string
  /** Human-unit supply (pre-decimals). */
  supply: number
  /** Graduation SOL target. */
  solTarget: number
  curveType?: LaunchCurvePreset
  creatorWallet: string
  /** Optional vesting lock (human units of supply). */
  totalLockedAmount?: number
  cliffPeriodSec?: number
  unlockPeriodSec?: number
  website?: string
  twitter?: string
  telegram?: string
  discord?: string
}

export type LaunchPrepareBlocked = {
  blocked: true
  reasons: string[]
}

export type LaunchPrepareOk = {
  blocked: false
  mint: string
  poolId: string
  platformId: string
  /** Base64 VersionedTransactions — mint may be partially signed; user wallet must co-sign. Never signed by platform keys. */
  transactions: string[]
  params: {
    name: string
    ticker: string
    supply: string
    totalSellA: string
    totalFundRaisingB: string
    decimals: number
    migrateType: 'cpmm'
    solTarget: number
  }
  compliance: string
  /** Present when prepare included a live fee quote. */
  feeEstimate?: LaunchFeeBreakdown
  trackingId: string
  metadataUri: string
}

export type LaunchRecord = {
  id: string
  mint: string
  creator: string
  name: string
  ticker: string
  description: string | null
  imageUrl: string | null
  supply: string
  totalSellA: string
  totalFundRaisingB: string
  solTarget: number
  curveType: string
  platformId: string
  poolId: string | null
  txSignature: string
  safetyScore: number | null
  riskScore: number | null
  verdict: RevenueVerdict | null
  badge: RevenueVerdict | null
  migrationStatus: 'curve' | 'migrate' | 'migrated'
  migratedAt: string | null
  migrationTx: string | null
  createdAt: string
}
