/**
 * AI OS briefing types — Decision Engine driven, no fabricated fields.
 */

import type { Decision } from '@cryptocheck/decision-contracts'

export type OsIntentId =
  | 'invest'
  | 'passive'
  | 'monitor'
  | 'protect'
  | 'copy_strategy'

export type OsMarketSignal = {
  id: 'fear' | 'greed' | 'whales' | 'smart_money' | 'narrative'
  label: string
  value: string | null
  detail: string | null
  available: boolean
}

export type OsCoachLine = {
  id: string
  text: string
}

export type OsRecommendation = {
  kind: 'wait' | 'opportunity' | 'unavailable'
  headline: string
  detail: string | null
  confidence: number | null
  action: Decision['action'] | null
  symbol: string | null
  decisionId: string | null
  confidenceMode: Decision['confidenceMode'] | null
}

export type OsBriefing = {
  greeting: string
  coachLines: OsCoachLine[]
  market: OsMarketSignal[]
  recommendation: OsRecommendation
  decision: Decision | null
  decisions: Decision[]
  dna: {
    available: boolean
    sampleSize: number
    styleSummary: string | null
    confidence: number | null
  }
  portfolio: {
    available: boolean
    holdingCount: number
    totalUsd: number | null
  }
  provenance: {
    demo: boolean
    stale: boolean
    source: string
    computedAt: string
  }
  insufficient: boolean
  message: string | null
}
