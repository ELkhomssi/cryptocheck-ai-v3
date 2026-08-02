/**
 * Trade Like Me — Master Spec V2 domain contracts.
 * Moat rules: retention via confidence/sampleSize, explainable decisions,
 * collective intelligence without leaking private strategies.
 * Engines speak these types; UI never invents business rules.
 */

import type { ChainId } from '@/features/terminal-os/shared/types'

export type TlmDecisionAction = 'BUY' | 'SELL' | 'WAIT' | 'EXIT' | 'DO_NOTHING'
export type TradeAction = TlmDecisionAction

export type StyleVectorKey =
  | 'momentum'
  | 'scalper'
  | 'swingTrader'
  | 'narrativeTrader'
  | 'whaleFollower'
  | 'meanReversion'
  | 'breakoutTrader'
  | 'liquidityHunter'

/** Style vector — weights sum to 1.0 */
export type StyleVector = Record<StyleVectorKey, number>

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

/** Typed bus events — engines never call each other's internals */
export type TlmEventType =
  | 'TradeRecorded'
  | 'RejectionRecorded'
  | 'DNAUpdated'
  | 'OpportunityScored'
  | 'DecisionMade'
  | 'DisagreementRaised'
  | 'ExecutionCompleted'
  | 'ExecutionBlocked'
  | 'TeachNote'
  | 'AnalyticsUpdated'
  | 'CollectiveSignalReady'
  | 'SessionStarted'
  | 'SessionStopped'
  /** Attention Feed subscriptions — emitted when MarketContext materially shifts */
  | 'MarketContextChanged'
  /** Security Scanner / risk band newly flags a held or watched token */
  | 'SecurityFlagRaised'
  /** Portfolio Intelligence detects real holdings / allocation / exposure change */
  | 'PortfolioChanged'
  // legacy aliases kept for subscribers during migration
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

export interface TradeContextAtEntry {
  volatility24h: number
  volumeToLiquidityRatio: number
  whaleActivityScore: number
  walletScore: number
  tokenScore: number
  riskScore: number
  socialMomentum: number
  newsSentiment: number
  hourOfDay: number
  dayOfWeek: number
}

/** V2 capture contract — executed trades AND scan-then-walk-away rejections */
export interface CapturedTrade {
  id: string
  wallet: string
  token: { symbol: string; address: string; chain: ChainId }
  entry: { time: string; price: number; marketCap: number; liquidity: number }
  exit?: { time: string; price: number }
  positionSizeUsd: number
  pnlPct?: number
  holdingDurationMs?: number
  contextAtEntry: TradeContextAtEntry
  execution: { gasFeeUsd: number; slippagePct: number }
  /** User scanned but did NOT trade — as valuable as a trade */
  wasRejectedOpportunity: boolean
  rejectionReasonInferred?: string
  entryWhy?: string
  exitWhy?: string
  sample?: boolean

  // ── Flat accessors for engines that still read V1 shape (derived) ──
  /** @deprecated prefer token.symbol */
  tokenSymbol: string
  tokenMint: string
  chain: ChainId
  side: 'buy' | 'sell' | 'reject'
  entryAt: string
  exitAt: string | null
  entryPriceUsd: number
  exitPriceUsd: number | null
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
}

export interface WeightedTag {
  tag: string
  weight: number
}

export interface ConditionRange {
  field: keyof TradeContextAtEntry | 'marketCap' | 'liquidity' | 'positionSizeUsd'
  op: '>' | '>=' | '<' | '<=' | 'between'
  value: number
  valueHi?: number
  weight: number
  label: string
  evidence: string
}

export interface TraderDna {
  wallet: string
  updatedAt: string
  /** Weighted style vector — sums to ~1.0 */
  styleVector: StyleVector
  /** Human summary derived from styleVector */
  tradingStyleSummary: string
  /** 0–100 from realized sizing vs account heuristics */
  riskAppetite: number
  riskAppetiteLabel: 'conservative' | 'moderate' | 'aggressive' | 'degen'
  favoriteSectors: WeightedTag[]
  favoriteChains: WeightedTag[]
  avgHoldingMs: number
  entryConditionProfile: ConditionRange[]
  exitConditionProfile: ConditionRange[]
  winRatePct: number
  avgRoiPct: number
  /** Largest drawdown historically held through before exit */
  lossTolerancePct: number
  disciplineScore: number
  emotionalBiasScore: number
  /**
   * Retention metric — grows with sample size.
   * Show prominently: cost of leaving = restarting this number.
   */
  confidence: number
  /** Trades + rejections used — the "you'd lose this by leaving" number */
  sampleSize: number
  tradeCount: number
  rejectionCount: number
  sample?: boolean

  // V1 compat aliases used by existing UI
  /** @deprecated use confidence */
  confidenceScore: number
  styles: { tag: string; weight: number }[]
  typicalEntry: { label: string; weight: number; evidence: string }[]
  typicalExit: { label: string; weight: number; evidence: string }[]
}

export interface MarketContext {
  tokenSymbol: string
  tokenAddress?: string
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
  volumeToLiquidityRatio: number
  whaleActivityScore: number
  predictionUpsidePct: number
  /** Condition vector for cosine similarity vs entry profile */
  conditionVector: Record<string, number>
  sources: string[]
  fetchedAt: string
  sample?: boolean
}

/** @deprecated alias — Market Intelligence emits MarketContext */
export type MarketIntelSnapshot = MarketContext

export interface UserWeightPrefs {
  behaviorMatch: number
  marketQuality: number
  probability: number
  timing: number
  executionQuality: number
  riskPenalty: number
}

export const DEFAULT_WEIGHT_PREFS: UserWeightPrefs = {
  behaviorMatch: 0.28,
  marketQuality: 0.22,
  probability: 0.18,
  timing: 0.12,
  executionQuality: 0.1,
  riskPenalty: 0.1,
}

export interface OpportunityScore {
  behaviorMatch: number
  marketQuality: number
  risk: number
  probability: number
  expectedRoiPct: number
  expectedDrawdownPct: number
  timing: number
  executionQuality: number
  confidence: number
  action: TlmDecisionAction
  /** Traceability — which DNA/Market fields drove the score */
  citations: ScoreCitation[]
}

export interface ScoreCitation {
  source: 'TraderDNA' | 'MarketContext' | 'Collective' | 'Weights'
  field: string
  value: string | number
  contribution: string
}

export interface DecisionScores {
  behaviorMatch: number
  marketQuality: number
  risk: number
  probability: number
  expectedRoiPct: number
  expectedDrawdownPct: number
  confidence: number
  marketConfidence: number
  personalizedConfidence?: number
  confidenceMode: 'market' | 'personalized'
  timing: number
  executionQuality: number
}

export interface DisagreementCheck {
  userWouldTypically: TradeAction
  aiRecommends: TradeAction
  overrideReason: string
  overrideConfidence: number
  requiresExplicitUserAck: boolean
  marketDeviationCited: string[]
}

export interface ExplainableDecision {
  id: string
  action: TlmDecisionAction
  scores: DecisionScores
  opportunity: OpportunityScore
  reasons: string[]
  disagreements: string[]
  disagreement: DisagreementCheck | null
  estimatedUpsidePct: number
  estimatedDownsidePct: number
  tokenSymbol: string
  chain: ChainId
  madeAt: string
  improvesTrader: boolean
  summary: string
  citations: ScoreCitation[]
  degraded?: boolean
  degradedInputs?: string[]
}

export interface AutonomyConfig {
  enabled: boolean
  confidenceThreshold: number
  maxPositionUsd: number
  maxDailyLossPct: number
  maxDailyActions: number
  allowedChains: ChainId[]
  requireConfirmation: boolean
  mandatoryStopLossPct: number
}

export interface AutonomyAuditEntry {
  id: string
  at: string
  opportunity: OpportunityScore
  dnaSnapshot: Pick<TraderDna, 'confidence' | 'sampleSize' | 'styleVector' | 'riskAppetite'>
  permissionTier: string
  explanation: string
  plannedAction: TlmDecisionAction
  wouldExecute: boolean
  blockedReason: string | null
}

export interface AutonomousPlan {
  armed: boolean
  blockedReason: string | null
  plannedAction: TlmDecisionAction | null
  wouldExecute: boolean
  config: AutonomyConfig
  audit: AutonomyAuditEntry | null
}

export interface PerformanceReport {
  periodLabel: string
  opportunitiesAnalyzed: number
  tradesAnalyzed: number
  aiFollowRoiPct: number
  traderBaselineRoiPct: number
  aiWinRatePct: number
  traderWinRatePct: number
  alphaVsSelfPct: number
  drawdownImprovementPct: number
  avgHoldImprovementMs: number
  proofLine: string
  notes: string[]
  sample?: boolean
}

/** Anonymized cluster signal — never exposes wallet/identity */
export interface CollectiveSignal {
  clusterId: string
  similarDnaCount: number
  setupLabel: string
  avgOutcomePct: number
  holdWindowLabel: string
  consentRequired: true
  anonymized: true
}

export interface CollectiveConsent {
  optedIn: boolean
  updatedAt: string
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
  collective: CollectiveSignal | null
  collectiveConsent: CollectiveConsent
  auditLog: AutonomyAuditEntry[]
  statusLine: string
  events: TlmEvent[]
}

/** Legacy style tag mapping */
export type TradingStyleTag =
  | 'momentum'
  | 'scalper'
  | 'swing'
  | 'narrative'
  | 'whale_follower'
  | 'mean_reversion'
  | 'breakout'
  | 'liquidity_hunter'
