import type { RevenueVerdict } from '@/lib/revenue-dashboard/types'

export { LAUNCH_COMPLIANCE } from './constants'

/** Curve presets exposed in the Action Panel Launch form. */
export type LaunchCurvePreset = 'justsendit' | 'custom'

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
