/**
 * Capital rotation shared types — safe for client + server.
 * (Store implementation stays server-only in rotation-store.ts)
 */

import type { Decision } from '@cryptocheck/decision-contracts'

export const DEFAULT_LOSS_THRESHOLD_PCT = 8

export type RotationPermissionMode = 'advise_only' | 'execute_with_confirmation' | 'bounded_autonomy'

export type RotationThreshold = {
  wallet: string
  thresholdPct: number
  source: 'trader_dna' | 'user' | 'default'
  personalized: boolean
  updatedAt: string
}

export type RotationProposal = {
  id: string
  wallet: string
  status: 'proposed' | 'approved' | 'rejected' | 'expired'
  permissionMode: RotationPermissionMode
  exit: {
    mint: string
    symbol: string
    pnlPctFromEntry: number
    /** entry = FIFO cost basis; change_24h = proxy when entry unavailable (must be labeled) */
    pnlBasis: 'entry' | 'change_24h'
    decision: Decision
    deteriorationReasons: string[]
  }
  entry: {
    mint: string
    symbol: string
    decision: Decision
    securityVerdict: string
    securityPassed: boolean
  }
  thresholdPct: number
  thresholdSource: RotationThreshold['source']
  createdAt: string
  honestyNote: string
}

export type RotationEvent = {
  id: string
  wallet: string
  linkedAt: string
  exit: {
    mint: string
    symbol: string
    pnlPctFromEntry: number
    reason: string
    decisionId: string
  }
  entry: {
    mint: string
    symbol: string
    confidence: number
    reason: string
    decisionId: string
  }
  exitResultPct: number
  entryResultPct: number | null
  thresholdPct: number
  permissionMode: RotationPermissionMode
}

export type RotationAggregateStats = {
  eventCount: number
  avgExitResultPct: number | null
  lossExitCount: number
  measuredEntryCount: number
  avgEntryResultPct: number | null
  aggregateNetPct: number | null
  honestyNote: string
}
