import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { ScanResult } from '@/lib/revenue-dashboard/types'
import type { ChartMode } from './constants'

/** Coach token verdict — maps gateway/revenue scan; never invents confidence %. */
export type TerminalVerdict =
  | 'SAFE'
  | 'CAUTION'
  | 'HIGH_RISK'
  | 'BLOCKED'
  | 'INSUFFICIENT_DATA'

export type ConfidenceBand = 'low' | 'medium' | 'high'

export type EvidenceBullet = {
  text: string
  source: string
}

/**
 * TokenVerdictCard contract (Prompt 4).
 * `confidenceBand` derived only from evidence coverage — never free-floating %.
 */
export type TokenVerdictCard = {
  mint: string
  asOf: string
  verdict: TerminalVerdict
  evidence: {
    present: string[]
    required: string[]
    coverage: number
  }
  confidenceBand: ConfidenceBand
  why: EvidenceBullet[]
  risks: EvidenceBullet[]
  opportunities: EvidenceBullet[]
  scanId: string
  /** Pass-through for sample tagging. */
  sample: boolean
  /** Raw safety/risk for display — from gateway only. */
  safetyScore: number | null
  riskScore: number | null
}

export type ChartSlotState = {
  mint: string
  symbol: string
  locked: boolean
}

export type TerminalFocusState = {
  focusMint: string
  focusSymbol: string
  focusSignal: UnifiedSignal | null
  chartMode: ChartMode
  slots: ChartSlotState[]
  activeSlot: number
  scan: ScanResult | null
  scanning: boolean
  scanError: string | null
  ticketSide: 'buy' | 'sell'
  coachCollapsed: boolean
  discoverCollapsed: boolean
  positionsOpen: boolean
}

export type PortfolioStripData = {
  walletAddress: string
  totalValueUsd: number
  holdingCount: number
  flaggedCount: number
  exposure: string
  topAlert: string | null
  lastUpdatedAt: string
  positions: Array<{
    mint: string
    symbol: string
    valueUsd: number
    verdict: string
    riskScore: number
  }>
}
