/**
 * Trade Like Me — domain contracts.
 * Engines speak these types; UI never invents business rules.
 */

import type { ChainId } from '@/features/terminal-os/shared/types'

export type TlmDecisionAction = 'BUY' | 'SELL' | 'WAIT' | 'EXIT' | 'DO_NOTHING'

export type TradingStyleTag =
  | 'momentum'
  | 'scalper'
  | 'swing'
  | 'narrative'
  | 'whale_follower'
  | 'mean_reversion'
  | 'breakout'
  | 'liquidity_hunter'

export type TlmEnginePhase =
  | 'idle'
  | 'awaiting_wallet'
  | 'recording'
  | 'building_dna'
  | 'learning'
  | 'ready'
  | 'watching'
  | 'autonomous_armed'
  | 'paused'

export type TlmEventType =
  | 'tlm.session.started'
  | 'tlm.session.stopped'
  | 'tlm.trade.recorded'
  | 'tlm.dna.updated'
  | 'tlm.opportunity.scored'
  | 'tlm.decision.made'
  | 'tlm.autonomy.blocked'
  | 'tlm.autonomy.planned'
  | 'tlm.teach.note'
  | 'tlm.analytics.updated'

export interface TlmEvent<T = unknown> {
  type: TlmEventType
  at: string
  payload: T
  source: string
}

/** Captured trade context — Phase 1 behavioral learning record */
export interface CapturedTrade {
  id: string
  wallet: string
  tokenSymbol: string
  tokenMint: string
  chain: ChainId
  side: 'buy' | 'sell'
  entryAt: string
  exitAt: string | null
  entryPriceUsd: number
  exitPriceUsd: number | null
  pnlPct: number | null
  holdingDurationMs: number | null
  positionSizeUsd: number
  marketCapUsd: number | null
  liquidityUsd: number | null
  volume24hUsd: number | null
  volatilityPct: number | null
  whaleActivityScore: number | null
  walletScore: number | null
  tokenScore: number | null
  riskScore: number | null
  socialMomentum: number | null
  newsSentiment: number | null
  gasFeeUsd: number | null
  slippageBps: number | null
  hourOfDay: number
  dayOfWeek: number
  /** Why the user entered — taught or inferred */
  entryWhy?: string
  /** Why the user exited — taught or inferred */
  exitWhy?: string
  sample?: boolean
}

export interface EntryExitCondition {
  label: string
  weight: number
  evidence: string
}

export interface TraderDna {
  wallet: string
  updatedAt: string
  tradeCount: number
  styles: { tag: TradingStyleTag; weight: number }[]
  tradingStyleSummary: string
  riskAppetite: 'conservative' | 'moderate' | 'aggressive' | 'degen'
  favoriteSectors: string[]
  favoriteChains: { chain: ChainId; weight: number }[]
  avgHoldingMs: number
  typicalEntry: EntryExitCondition[]
  typicalExit: EntryExitCondition[]
  avgRoiPct: number
  winRatePct: number
  lossTolerancePct: number
  disciplineScore: number
  emotionalBiasScore: number
  confidenceScore: number
  sample?: boolean
}

export interface MarketIntelSnapshot {
  tokenSymbol: string
  chain: ChainId
  whaleBias: 'accumulating' | 'distributing' | 'neutral'
  liquidityTrend: 'increasing' | 'decreasing' | 'stable'
  smartMoneyScore: number
  walletQuality: number
  tokenScore: number
  securityBand: 'excellent' | 'good' | 'caution' | 'danger'
  riskScore: number
  newsSentiment: number
  marketSentiment: number
  orderFlowBias: 'buy' | 'sell' | 'mixed'
  volumeScore: number
  volatilityPct: number
  predictionUpsidePct: number
  sources: string[]
  fetchedAt: string
  sample?: boolean
}

export interface DecisionScores {
  behaviorMatch: number
  marketQuality: number
  risk: number
  probability: number
  expectedRoiPct: number
  expectedDrawdownPct: number
  confidence: number
  timing: number
  executionQuality: number
}

export interface ExplainableDecision {
  id: string
  action: TlmDecisionAction
  scores: DecisionScores
  reasons: string[]
  disagreements: string[]
  estimatedUpsidePct: number
  estimatedDownsidePct: number
  tokenSymbol: string
  chain: ChainId
  madeAt: string
  improvesTrader: boolean
  summary: string
}

export interface AutonomousPlan {
  armed: boolean
  blockedReason: string | null
  plannedAction: TlmDecisionAction | null
  wouldExecute: boolean
  config: AutonomyConfig
}

export interface AutonomyConfig {
  enabled: boolean
  confidenceThreshold: number
  maxPositionUsd: number
  maxDailyLossPct: number
  allowedChains: ChainId[]
  requireConfirmation: boolean
}

export interface PerformanceReport {
  periodLabel: string
  tradesAnalyzed: number
  aiWinRatePct: number
  traderWinRatePct: number
  alphaVsSelfPct: number
  avgHoldImprovementMs: number
  notes: string[]
  sample?: boolean
}

export interface TradeLikeMeState {
  phase: TlmEnginePhase
  wallet: string | null
  learningProgressPct: number
  analyzing: string[]
  dna: TraderDna | null
  currentOpportunity: ExplainableDecision | null
  lastDecision: ExplainableDecision | null
  openPosition: {
    tokenSymbol: string
    chain: ChainId
    sizeUsd: number
    unrealizedPnlPct: number
  } | null
  autonomy: AutonomousPlan
  performance: PerformanceReport | null
  statusLine: string
  events: TlmEvent[]
}
